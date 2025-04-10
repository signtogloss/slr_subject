// App.js

import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import './App.css';
import './modern-styles.css';


const App = () => {
  return (
    <div id="root">

          <Navbar />
          <div className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
            </Routes>
          </div>     
    </div>
  );
};


const AppWrapper = () => {
  return (
    <Router>
      <App />
    </Router>
  );
};

export default AppWrapper;
