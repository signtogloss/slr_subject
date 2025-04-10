import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">SignBridge</Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav">
            <li className="nav-item">
              <Link className="nav-link hover-lift" aria-current="page" to="/">Sign language recognition</Link>
            </li>
            {/* 注释掉第二个导航项
            <li className="nav-item">
              <Link className="nav-link hover-lift" to="/new">Speech2Text</Link>
            </li>
            */}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
