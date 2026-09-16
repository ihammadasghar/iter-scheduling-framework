// Shared name pools for the mock-data generators — realistic professor/course
// names instead of "Professor 1"/"Course 1", so the UI reads like a real
// schedule regardless of which generator produced the underlying data.

export const FIRST_NAMES = [
  'Jane', 'Alan', 'Bob', 'Maria', 'Wei', 'Fatima', 'John', 'Priya', 'Carlos', 'Aisha',
  'David', 'Elena', 'Kenji', 'Sofia', 'Omar', 'Grace', 'Liam', 'Noor', 'Ivan', 'Mei',
];

export const LAST_NAMES = ['Smith', 'Jones', 'Chen', 'Garcia', 'Khan', 'Muller', 'Kim', 'Patel', 'Silva', 'Nguyen'];

export const COURSE_TEMPLATES = [
  'Introduction to', 'Advanced', 'Foundations of', 'Topics in',
  'Principles of', 'Seminar in', 'Applied', 'History of',
];

// Real ISCTE programs (Curso proxy code), each with a curated pool of real
// course names and real Turma cohort tokens, hand-extracted from
// docs/ISCTE-1st-Semester-22-23-Schedule-rooms-assigned.csv (top 20 programs
// by row count that had enough distinct courses/turmas to draw from). Used
// by generate-large-schedule.ts so its "department" vocabulary is authentic
// ISCTE naming rather than a generic "Biology"/"History" placeholder list —
// unlike importIsteDataset.ts, this doesn't read the CSV at generation time
// (that dataset is a different, real-data pipeline entirely), it just
// borrows real-world-flavored names for an otherwise synthetic, scale-
// controlled dataset.
export const ISCTE_PROGRAMS: readonly {
  readonly code: string;
  readonly courses: readonly string[];
  readonly turmas: readonly string[];
}[] = [
  { code: 'LETI', courses: ['Arquitetura de Redes', 'Bases de Dados', 'Cálculo I', 'Electromagnetismo', 'Electrónica Programada e Processamento Digital de Sinais', 'Engenharia de Software', 'Fundamentos de Arquitectura de Computadores', 'Fundamentos de Sinais e Sistemas'], turmas: ['EI-A1', 'EI-A10', 'EI-A11', 'EI-A12'] },
  { code: 'LFC', courses: ['Avaliação e Reestruturação de Empresas', 'Contabilidade de Gestão II', 'Controlo de Gestão', 'Cálculo Financeiro', 'Direito das Sociedades Comerciais', 'Estatística I', 'Finanças Internacionais', 'Fiscalidade'], turmas: ['FCA1', 'FCA2', 'FCA3', 'FCB1'] },
  { code: 'LG', courses: ['Empreendedorismo', 'Estratégia Empresarial', 'Finanças de Empresa', 'Gestão Integrada das Operações', 'Investigação Operacional', 'Macroeconomia', 'Marketing Operacional', 'Microeconomia'], turmas: ['GA1', 'GA2', 'GA3', 'GA4'] },
  { code: 'LE', courses: ['Contabilidade Financeira I', 'Direito Económico', 'Econometria II', 'Economia da Organização Industrial', 'Economia do Trabalho e dos Recursos Humanos', 'Economia e Políticas de Desenvolvimento', 'Estatística', 'Informática para Economistas'], turmas: ['EA1', 'EA2', 'EA3', 'EB1'] },
  { code: 'MIA', courses: ['Ambiente e Sustentabilidade', 'Arquitectura I', 'Arquitectura III', 'Arquitectura V', 'Comunicação Visual II', 'Cultura Arquitetónica', 'Desenho I', 'Desenho III'], turmas: ['ARQ-A1', 'ARQ-A2', 'ARQ-A3', 'ARQ-A4'] },
  { code: 'LCD', courses: ['Análise de Redes', 'Armazenamento para Big Data', 'Dados na Ciência, Gestão e Sociedade', 'Estatística Computacional', 'Fundamentos de Álgebra Linear', 'Fundamentos em Gestão de Bases de Dados', 'Inteligência Artificial Simbólica para Ciência de Dados', 'Interfaces Web para A Gestão de Dados'], turmas: ['CDA1', 'CDA1PL', 'CDA2', 'CDA2PL'] },
  { code: 'LIGE', courses: ['Análise de Dados Multivariada', 'Conceção e Viabilidade de Projeto de Base Tecnológica', 'Fundamentos de Contabilidade de Gestão', 'Gestão das Operações e da Cadeia de Abastecimento', 'Gestão de Projectos de Tecnologia e Sistemas de Informação', 'Gestão de Recursos Humanos e de Equipas', 'Gestão e Sistemas de Informação nas Organizações', 'Investimentos e Mercados Financeiros'], turmas: ['IGE-A1', 'IGE-A10', 'IGE-A11', 'IGE-A12'] },
  { code: 'CT', courses: ['Apresentações Profissionais', 'Competências para o Mercado de Trabalho', 'Diversidade no Local de Trabalho', 'Escrita de Textos Técnicos e Científicos', 'Excel Avançado', 'Finanças Pessoais I', 'Gestão da Imagem Pessoal', 'Gestão de Conflitos'], turmas: ['CDA1', 'CDA1PL', 'CDA2', 'CDA2PL'] },
  { code: 'LCP', courses: ['Análise de Dados em Ciências Sociais - Descritiva', 'Análise de Dados em Ciências Sociais: Multivariada I', 'Cidadania e Cultura Política', 'Economia Política e Globalização', 'Estado e Políticas Públicas', 'História Política Contemporânea de Portugal', 'Instituições Políticas', 'Introdução à Ciência Política'], turmas: ['CP3 - Inglês', 'CPA1', 'CPA2', 'CPB1'] },
  { code: 'LEI', courses: ['Agentes Autónomos', 'Probabilidades e Processos Estocásticos', 'Processamento de Informação', 'Programação Concorrente e Distribuída', 'Teoria da Computação', 'Tópicos de Matemática para Computação'], turmas: ['EI-B1', 'EI-B10', 'EI-B11', 'EI-B12'] },
  { code: 'LS', courses: ['Análise de Dados em Ciências Sociais: Modelos de Dependência', 'Cultura e Sociedade', 'Laboratório de Elaboração de Projectos em Sociologia', 'Laboratório de Pesquisa Observacional', 'Objecto e Método da Sociologia', 'Teorias Sociológicas Clássicas', 'Teorias Sociológicas Contemporâneas'], turmas: ['S-PL-A1', 'S-PL-A2', 'S-PL-B1', 'S-PL-C1'] },
  { code: 'LP', courses: ['Aprendizagem, Motivação e Emoção', 'Competências Académicas I', 'Comportamento Organizacional - Processos Individuais', 'Estatística e Análise de Dados II', 'Estatística e Análise de Dados III', 'História da Psicologia', 'Métodos de Investigação Quantitativos', 'Métodos e Áreas de Aplicação da Psicologia'], turmas: ['PA1', 'PA2', 'PA3', 'PA4'] },
  { code: 'LGRH', courses: ['Análise de Dados em Gestão de Recursos Humanos I', 'Análise de Dados em Gestão de Recursos Humanos III', 'Análise e Finanças de Empresa', 'Avaliação de Desempenho', 'Comunicação Organizacional', 'Deontologia e Competências Profissionais em Grh', 'Desenho de Sistemas de Recompensa e Carreiras', 'Diagnóstico e Mudança Organizacional'], turmas: ['GRHA1', 'GRHA2', 'GRHB1', 'GRHC1'] },
  { code: 'LSS-PL', courses: ['Abordagens à Psicopatologia', 'Demografia', 'Direito Social', 'Laboratório de Ética e Profissão em Serviço Social', 'Laboratório em Domínios e Campos do Serviço Social', 'Métodos e Técnicas de Investigação em Ciências Sociais', 'Seminário Prática Profissional em Serviço Social', 'Seminário de Grupos e Intervenção Comunitária'], turmas: ['SS-PL-A1', 'SS-PL-A2', 'SS-PL-B1', 'SS-PL-B2'] },
  { code: 'CIESPP', courses: ['Análise de Arquivos e de Outras Fontes Documentais', 'Análise de Campanhas Políticas', 'Análise de Conteúdo com Programas Informáticos', 'Análise de Indicadores Estatísticos', 'Análise de Redes em Ciências Sociais', 'Avaliação Participativa em Ação Humanitária', 'Economia e Poder em África', 'Guerras e Revoluções na Europa Contemporânea'], turmas: ['CI-ESPP-1', 'CI-ESPP-2', 'CI-IBS', 'CI_ESPP_EN'] },
  { code: 'MG', courses: ['Análise de Dados', 'Contabilidade Avançada', 'Estratégia Financeira da Empresa', 'Estratégia e Desenvolvimento Empresarial', 'Planeamento e Inovação em Marketing', 'Seminário de Investigação em Gestão'], turmas: ['MGA1', 'MGA2', 'MGA3', 'MGA4'] },
  { code: 'CIISTA', courses: ['Animação e Controlo de Personagens Virtuais', 'Aplicações de Sistemas Integrados de Apoio à Decisão', 'Aprendizagem Profunda para Visão por Computador', 'Design e Produção de Jogos Digitais', 'Fundamentos de Ciência dos Dados', 'Internet das Coisas para Cidades Inteligentes', 'Introdução à Ciência de Dados', 'Laboratório de Comunicações Ópticas'], turmas: ['CI-ISTA-LIC-1', 'CI-ISTA-LIC-2', 'CI-ISTA-MIA-1', 'CI-ISTA-Mest-1'] },
  { code: 'LGM', courses: ['Análise de Dados em Marketing', 'Comportamento e Experiência do Consumidor', 'Comunicação Integrada em Marketing', 'Economia', 'Gestão de Operações e Logística', 'Gestão de Vendas', 'Marketing Digital e E-Business', 'Marketing Intelligence'], turmas: ['GMKA1', 'GMKA2', 'GMKB1', 'GMKC1'] },
  { code: 'CIIBS', courses: ['Comunicação em Educação', 'Contabilidade e Finanças para Organizações Culturais', 'Contabilidade e Reporte Financeiro', 'Economia do Ambiente e dos Recursos Naturais', 'Economia do Turismo', 'Empresas e Ambiente', 'Fundamentos de Finanças da Empresa', 'Fusões, Aquisições e Avaliação de Empresas'], turmas: ['CI-IBS-1', 'CI-IBS-2', 'MEGC-A1', 'MEGC-A2'] },
  { code: 'METI', courses: ['Armazenamento de Dados em Ambientes distribuídos', 'Dissertação em Engenharia de Telecomunicações e Informática', 'Inteligência e Gestão de Redes e Serviços', 'Redes Ópticas', 'Segurança em Redes e Sistemas de Informação', 'Sistemas de Comunicação Multimédia', 'Sistemas e Redes de Comunicação para Móveis Avançados'], turmas: ['MEI-A1', 'MEI-A2', 'MEI-PL-A1', 'METI-A1'] },
];
