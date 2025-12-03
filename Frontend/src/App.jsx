import React from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import BoardPage from './pages/BoardPage';

function App() {
  return (
    <Provider store={store}>
      <BoardPage />
    </Provider>
  );
}

export default App;