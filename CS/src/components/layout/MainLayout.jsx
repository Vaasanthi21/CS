import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

// Channel → Color mapping
const channelColors = {
  instagram: "#E1306C",
  linkedin: "#0077B5",
  youtube: "#FF0000",
  twitter: "#1DA1F2",
  threads: "#000000",
  facebook: "#1877F2",
  github: "#333333",
};

export default function MainLayout() {
  const location = useLocation();
  const [activePersona, setActivePersona] = useState(() => {
    return localStorage.getItem("activePersona") || "uden_tech";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = location.pathname || '/';
  const hideTopNav = pathname === '/refine';

  useEffect(() => {
    localStorage.setItem("activePersona", activePersona);
  }, [activePersona]);

  const handlePersonaChange = (id) => {
    setActivePersona(id);
  };

  // 🎨 Adaptive persona color based on activePersona (channel)
  const personaColor = channelColors[activePersona] || "#333";

  return (
    <div 
      className="flex h-screen overflow-hidden bg-background"
      style={{ backgroundColor: personaColor }} // apply adaptive color here
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 lg:relative lg:z-0 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <Sidebar
          activePersona={activePersona}
          onPersonaChange={handlePersonaChange}
          collapsed={false}
        />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!hideTopNav ? (
          <TopNav
            activePersona={activePersona}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          />
        ) : null}
        <main className="flex-1 overflow-y-auto">
          <Outlet context={{ activePersona, setActivePersona: handlePersonaChange }} />
        </main>
      </div>
    </div>
  );
}