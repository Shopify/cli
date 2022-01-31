import React from 'react';
import {Redirect, useLocation} from 'react-router-dom';

function Home() {
  const location = useLocation();
  const defaultUrl = [
    location.pathname.replace(/\/$/, ''),
    'contributors/introduction',
  ].join('/');

  return <Redirect to={defaultUrl} />;
}

export default Home;
