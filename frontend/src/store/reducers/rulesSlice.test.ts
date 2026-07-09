import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import rulesReducer, {
  fetchMetricRulesThunk,
  createMetricRuleThunk,
  deleteMetricRuleThunk,
  fetchConstraintsThunk,
  deleteConstraintThunk,
  clearRulesError,
} from './rulesSlice';
import type { MetricRule, Constraint } from '@/types';

const fakeMetricRule: MetricRule = {
  id: 'metric-001',
  name: 'Room Utilization',
  target: 'Room',
  condition: 'utilization',
  threshold: 80,
};

const fakeConstraint: Constraint = {
  id: 'con-001',
  name: 'Max Load',
  target: 'Professor',
  violationCondition: 'max_classes_per_day > 6',
};

const makeStore = () => configureStore({ reducer: { rules: rulesReducer } });

describe('rulesSlice', () => {
  it('initialises with empty state and unavailable=false', () => {
    const store = makeStore();
    const state = store.getState().rules;
    expect(state.metrics).toEqual([]);
    expect(state.constraints).toEqual([]);
    expect(state.unavailable).toBe(false);
  });

  it('fetchMetricRulesThunk.fulfilled stores rules', () => {
    const store = makeStore();
    store.dispatch(fetchMetricRulesThunk.fulfilled([fakeMetricRule], 'r', undefined));
    expect(store.getState().rules.metrics).toHaveLength(1);
    expect(store.getState().rules.metrics[0].condition).toBe('utilization');
  });

  it('fetchMetricRulesThunk.rejected with 501 sets unavailable=true', () => {
    const store = makeStore();
    const err501 = { statusCode: 501, code: 'NOT_IMPLEMENTED', message: 'Not impl' };
    store.dispatch(fetchMetricRulesThunk.rejected(null, 'r', undefined, err501));
    const state = store.getState().rules;
    expect(state.unavailable).toBe(true);
    expect(state.error).toBeNull();
  });

  it('fetchMetricRulesThunk.rejected with non-501 sets error, not unavailable', () => {
    const store = makeStore();
    const err500 = { statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Server error' };
    store.dispatch(fetchMetricRulesThunk.rejected(null, 'r', undefined, err500));
    const state = store.getState().rules;
    expect(state.unavailable).toBe(false);
    expect(state.error).toBe('Server error');
  });

  it('fetchConstraintsThunk.rejected with 501 sets unavailable=true', () => {
    const store = makeStore();
    const err501 = { statusCode: 501, code: 'NOT_IMPLEMENTED', message: 'Not impl' };
    store.dispatch(fetchConstraintsThunk.rejected(null, 'r', undefined, err501));
    expect(store.getState().rules.unavailable).toBe(true);
  });

  it('createMetricRuleThunk.fulfilled appends new rule', () => {
    const store = makeStore();
    store.dispatch(fetchMetricRulesThunk.fulfilled([fakeMetricRule], 'r', undefined));
    const newRule: MetricRule = { ...fakeMetricRule, id: 'metric-002', name: 'Avg Load' };
    store.dispatch(createMetricRuleThunk.fulfilled(newRule, 'c', {
      name: 'Avg Load', target: 'Professor', condition: 'avg_classes_per_day', threshold: 4,
    }));
    expect(store.getState().rules.metrics).toHaveLength(2);
  });

  it('deleteMetricRuleThunk.fulfilled removes the rule', () => {
    const store = makeStore();
    store.dispatch(fetchMetricRulesThunk.fulfilled([fakeMetricRule], 'r', undefined));
    store.dispatch(deleteMetricRuleThunk.fulfilled('metric-001', 'd', 'metric-001'));
    expect(store.getState().rules.metrics).toHaveLength(0);
  });

  it('fetchConstraintsThunk.fulfilled stores constraints', () => {
    const store = makeStore();
    store.dispatch(fetchConstraintsThunk.fulfilled([fakeConstraint], 'r', undefined));
    expect(store.getState().rules.constraints).toHaveLength(1);
  });

  it('deleteConstraintThunk.fulfilled removes the constraint', () => {
    const store = makeStore();
    store.dispatch(fetchConstraintsThunk.fulfilled([fakeConstraint], 'r', undefined));
    store.dispatch(deleteConstraintThunk.fulfilled('con-001', 'd', 'con-001'));
    expect(store.getState().rules.constraints).toHaveLength(0);
  });

  it('clearRulesError resets the error field', () => {
    const store = makeStore();
    const err = { statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Oops' };
    store.dispatch(fetchMetricRulesThunk.rejected(null, 'r', undefined, err));
    expect(store.getState().rules.error).toBe('Oops');
    store.dispatch(clearRulesError());
    expect(store.getState().rules.error).toBeNull();
  });
});
