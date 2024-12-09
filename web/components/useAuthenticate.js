//import { useState, useEffect } from 'react';

//export const useAuthenticate = () => {
//  const [loading, setLoading] = useState(false);
//  const [authResult, setAuthResult] = useState(null);
//  const [error, setError] = useState(null);
//  const [sid, setSid] = useState(localStorage.getItem('sid') || null);

//  useEffect(() => {
//    if (sid) {
//      localStorage.setItem('sid', sid);
//    } else {
//      authenticate();
//    }
//  }, [sid]);

//  const authenticate = async () => {
//    try {
//      setLoading(true);
//      setError(null);

//      const response = await fetch('/auth-brain', {
//        method: 'POST',
//      });

//      const result = await response.json();
//      if (!response.ok) {
//        setError(`Error: ${result.error}`);
//        setAuthResult(null);
//      } else {
//        setAuthResult(JSON.stringify(result));
//        setSid(result.sid);
//      }
//    } catch (err) {
//      setError(`Error: ${result.error} (Details: ${result.details})`);
//      setAuthResult(null);
//    } finally {
//      setLoading(false);
//    }
//  };
//  const res = { loading, authResult, error, sid };
//  return res;
//};
