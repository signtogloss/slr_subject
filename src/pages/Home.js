import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import SignLanguageRecognition from "../components/SignLanguageRecognition";

const Home = () => {
  return (
    <div className="container my-4">
      <h1 className="text-center mb-4">Sign Language Recognition</h1>
      <div className="row justify-content-center">
        <div className="col-md-10 mb-4">
          <div className="card">
            <div className="card-header">Recognition</div>
            <div className="card-body">
              <SignLanguageRecognition />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
  
export default Home;
