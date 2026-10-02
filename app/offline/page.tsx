'use client';
import React from 'react';

export default function Offline() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <div className="text-6xl mb-6">🦉</div>
        <h1 className="text-3xl font-bold text-ink mb-4">Ops! Você está offline</h1>
        <p className="text-gray-600 mb-8">
          A corujinha precisa de internet para te ajudar nos estudos. 
          Verifique sua conexão e tente novamente!
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-primary text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-600 transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    </div>
  );
}
