# AGENTS.md

## Code Style

- TypeScript `strict` mode; never use `any`
- 2 spaces indentation, single quotes, semicolons required
- Max line length: 100 characters
- Explicit return types on functions
- Prefer `interface` over `type` for objects
- Use const assertions for literal types

**Naming:**
| Type | Convention | Example |
|------|------------|---------|
| Interfaces/Types | PascalCase | `Employee`, `SkillFilter` |
| Functions/Variables | camelCase | `fetchEmployee`, `isLoading` |
| Constants | UPPER_SNAKE_CASE | `BASE_API_URL` |
| React Components | PascalCase.tsx | `TopBanner.tsx` |
| Reducers | camelCaseReducer.ts | `employeeReducer.ts` |

---

## Design Principles

### 1. Dependency Injection
- Every class that calls an external system (graph DB, GitHub API, filesystem) **receives its dependencies through the constructor**, typed as interfaces.
- Never call `new ConcreteService()` inside a class body — always inject from outside.
- Define a `I<ServiceName>` interface for every injectable dependency.
- Tests pass mock objects that satisfy the interface — no module-level patching needed.

```typescript
interface IGitHubService {
  createBranch(params: CreateBranchParams): Promise<Branch>;
}

export class SimulationService {
  constructor(private readonly github: IGitHubService) {}

  async start(params: CreateBranchParams): Promise<Branch> {
    return this.github.createBranch(params);
  }
}
```

### 2. OOP Structure + Functional Method Style
- Use **classes** to group related behaviour and encapsulate dependencies (OOP).
- Write **methods** in a functional style — prefer `map`, `filter`, `reduce`, `flatMap` over imperative loops.
- Keep methods short and pure where possible; extract complex logic into small named private helpers.
- Compose helpers rather than writing deep method chains or nested ternaries.

### 3. Immutability
- All class fields and interface properties must be `readonly`.
- Never mutate function arguments — return new objects/arrays via spread or non-mutating array methods.
- Use `as const` for fixed-value lookup objects.
- Avoid in-place mutators: `push`, `splice`, `sort` (without copy), `delete obj[key]`.

---

## Testing Instructions

- Framework: Vitest with React Testing Library
- Follow AAA pattern: Arrange, Act, Assert
- Mock external dependencies by passing mock implementations to constructors (dependency injection) — avoid patching modules with `vi.mock` unless absolutely necessary
- Co-locate tests: `Component.test.tsx` next to `Component.tsx`
- Target: 80%+ coverage on controllers, 90%+ on utilities

**DI mocking example:**
```typescript
// Define interface
interface IGraphService { queryConflicts(simId: string): Promise<RawConflict[]>; }

// Test — inject mock directly; no module patching needed
describe('ConflictAnalyser', () => {
  it('filters out soft conflicts', async () => {
    // Arrange
    const mockGraph: IGraphService = {
      queryConflicts: vi.fn().mockResolvedValue([
        { id: '1', type: 'HARD', msg: 'Room overlap', severity: 10 },
        { id: '2', type: 'SOFT', msg: 'Gap too large', severity: 2 },
      ]),
    };
    const analyser = new ConflictAnalyser(mockGraph);

    // Act
    const result = await analyser.findConflicts('sim-1');

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('1');
  });
});
```

```bash
pnpm test              # Run all tests
pnpm test --watch      # Watch mode
pnpm test --coverage   # With coverage report
pnpm vitest run -t "<test name>"  # Run specific test
```

Add or update tests for any code you change, even if not explicitly asked.

---

## Commit and PR Instructions

**Branch naming:**
```
<type>/<number>-<description>
Example: feat/518-add-skill-categories
```

**Commit messages:**
```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
Example: feat(auth): add OAuth2 support
```

**Before committing:**
```bash
pnpm lint && pnpm test
```

**PR guidelines:**
- Keep PRs focused and reasonably sized
- Include clear description and testing notes
- Link related issues
- Outline approach in 3–5 bullet points
- Call out potential side effects

### Patterns

**Dependency Injection — controller pattern:**
```typescript
// Route handler — thin wrapper; delegates immediately
router.post('/', (req, res, next) => simulationController.create(req, res, next));

// Controller receives all dependencies via constructor
export class SimulationController {
  constructor(
    private readonly githubService: IGitHubService,
    private readonly graphService: IGraphService,
  ) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await this.githubService.createBranch(req.body);
      await this.graphService.hydrate(branch.id);
      res.status(201).json(branch);
    } catch (err) {
      next(err);
    }
  }
}
```

**OOP structure + functional method style:**
```typescript
export class ConflictAnalyser {
  constructor(private readonly graph: IGraphService) {}

  // Methods use map/filter/reduce — no for loops, no mutations
  async findConflicts(simId: string): Promise<Conflict[]> {
    const raw = await this.graph.queryConflicts(simId);
    return raw
      .filter(isHardConflict)
      .map(toConflictDto)
      .sort(bySeverity);
  }
}

// Small pure helpers extracted for composability and isolated testing
const isHardConflict = (r: RawConflict): boolean => r.type === 'HARD';
const toConflictDto  = (r: RawConflict): Conflict => ({ id: r.id, type: r.type, message: r.msg });
const bySeverity     = (a: Conflict, b: Conflict): number => b.severity - a.severity;
```

**Immutability:**
```typescript
// readonly on all interface fields and class properties
interface ScheduleClass {
  readonly id: string;
  readonly roomId: string;
  readonly timeSlotIds: readonly string[];
}

// Return new object — never mutate arguments
const reassignRoom = (cls: ScheduleClass, newRoomId: string): ScheduleClass =>
  ({ ...cls, roomId: newRoomId });

// as const for fixed lookup data
const CONFLICT_TYPES = ['ROOM_DOUBLE_BOOK', 'PROFESSOR_OVERLAP', 'GROUP_OVERLAP'] as const;
type ConflictType = typeof CONFLICT_TYPES[number];
```

---

### Target Frontend Structure (Atomic Design)
```
src/
├── atoms/           # Buttons, inputs, labels, icons, spinners
├── molecules/       # Form fields, search bars, cards, badges
├── organisms/       # Tables, forms, modals, navigation
├── templates/       # Page layouts (no data)
├── pages/           # Route components with data fetching
├── hooks/           # Custom React hooks
├── services/        # API calls
├── store/reducers/  # Redux slices
├── types/           # TypeScript interfaces
├── utils/           # Pure utility functions
└── styles/          # Theme and global CSS
```

### Atomic Design Rules

**atoms/** – Single-responsibility, context-agnostic, no business logic
```tsx
// atoms/Button.tsx
interface ButtonProps {
  variant: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
}
export const Button: React.FC<ButtonProps> = ({ variant, size = 'md', children, onClick }) => (
  <MuiButton variant={variant === 'primary' ? 'contained' : 'outlined'} size={size} onClick={onClick}>
    {children}
  </MuiButton>
);
```

**molecules/** – Combine 2-3 atoms, minimal local state, no API calls

**organisms/** – Complex sections, may use global state, contain molecules/atoms

**templates/** – Layout structure, accept children/slots, no data fetching

**pages/** – Route handlers, data orchestration, compose templates + organisms

### State Management
- Use Redux Toolkit with `createSlice` and `createAsyncThunk`
- Always use typed hooks: `useAppDispatch`, `useAppSelector`
- One slice per feature domain

```typescript
// Always use typed hooks
const dispatch = useAppDispatch();
const employee = useAppSelector((state) => state.employee.employee);

// Async operations in thunks
export const fetchEmployeeProfile = createAsyncThunk(
  'employee/fetchProfile',
  async (email: string) => {
    const authSession = await fetchAuthSession();
    const response = await axios.get(`${BASE_API_URL}/employees/${email}/profile`, {
      headers: { Authorization: authSession.tokens?.accessToken.toString() },
    });
    return response.data;
  }
);
```

### Styling
- Use MUI `sx` prop; never hardcode colors
- Reference theme: `theme.palette.primary.main`
- Co-locate CSS when needed

## Expectations
- Do not remove or rename files unless explicitly required
- Avoid large refactors unless specifically requested
- Keep commits focused on a single concern
- Follow TypeScript `strict` mode and never use `any`
- Always include proper error handling for async operations
- Include or update tests when changing behavior

## Communication
- Use clear and descriptive commit messages (`<type>(<scope>): <subject>`)
- Explain non-obvious decisions with comments or JSDoc
- When proposing code changes, outline the approach in 3–5 bullet points
- Reference similar existing code where relevant
- Call out potential side effects or related files that may need updates
