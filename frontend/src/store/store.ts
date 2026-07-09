import { configureStore } from '@reduxjs/toolkit';
import simulationReducer from './reducers/simulationSlice';
import classReducer from './reducers/classSlice';
import conflictReducer from './reducers/conflictSlice';
import metricReducer from './reducers/metricSlice';
import proposalReducer from './reducers/proposalSlice';
import rulesReducer from './reducers/rulesSlice';
import sessionReducer from './reducers/sessionSlice';
import uiReducer from './reducers/uiSlice';

export const store = configureStore({
  reducer: {
    simulation: simulationReducer,
    class: classReducer,
    conflict: conflictReducer,
    metric: metricReducer,
    proposal: proposalReducer,
    rules: rulesReducer,
    session: sessionReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
