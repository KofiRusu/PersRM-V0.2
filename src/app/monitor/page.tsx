'use client'

import React from 'react'
import Link from 'next/link'

export default function MonitorPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">PersLM Task Monitor</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/monitor/v0">
          <div className="border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer">
            <h2 className="text-xl font-semibold mb-2">V0 UI</h2>
            <p className="text-gray-600 mb-4">
              View the Task Monitor with the V0-generated UI. This version provides a different visual 
              approach to task management.
            </p>
            <span className="text-blue-600 text-sm">Open V0 UI →</span>
          </div>
        </Link>
        
        <div className="border rounded-lg p-6 opacity-50">
          <h2 className="text-xl font-semibold mb-2">Default UI</h2>
          <p className="text-gray-600 mb-4">
            The standard Task Monitor UI with all the core features for task management
            and progress tracking.
          </p>
          <span className="text-gray-400 text-sm">Coming soon</span>
        </div>
      </div>
    </div>
  )
} 