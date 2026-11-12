import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("clinic_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("clinic_token");
    if (!token) {
      setLoading(false);
      return;
    }
    // Always verify against the real backend so the role on file (and
    // therefore what the person can see/do) is never stale or spoofable
    // from whatever happened to be cached in localStorage.
    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data);
        localStorage.setItem("clinic_user", JSON.stringify(res.data));
      })
      .catch(() => {
        localStorage.removeItem("clinic_token");
        localStorage.removeItem("clinic_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const res = await api.post("/auth/login", { username, password });
    localStorage.setItem("clinic_token", res.data.token);
    localStorage.setItem("clinic_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem("clinic_token");
    localStorage.removeItem("clinic_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
