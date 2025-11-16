import { useState, useEffect } from 'react'
import axios from 'axios'

export default function ExaminerManager() {
  const [examiners, setExaminers] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    activeToday: 0
  })

  useEffect(() => {
    fetchExaminers()
  }, [])

  const fetchExaminers = async () => {
    try {
      const response = await axios.get('/api/admin/examiners')
      setExaminers(response.data.examiners)
      setStats({
        total: response.data.count,
        activeToday: 0 // Can be enhanced to track active sessions
      })
    } catch (error) {
      console.error('Error fetching examiners:', error)
      alert('Failed to fetch examiners')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading examiners...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Manage Examiners</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Total Examiners</div>
            <div className="text-3xl font-bold text-indigo-600">{stats.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Registered This Month</div>
            <div className="text-3xl font-bold text-green-600">
              {examiners.filter(e => {
                const created = new Date(e.createdAt)
                const now = new Date()
                return created.getMonth() === now.getMonth() &&
                       created.getFullYear() === now.getFullYear()
              }).length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Available</div>
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {examiners.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                  No examiners found
                </td>
              </tr>
            ) : (
              examiners.map(examiner => (
                <tr key={examiner._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-indigo-600 font-medium text-sm">
                          {examiner.firstName[0]}{examiner.lastName[0]}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {examiner.firstName} {examiner.lastName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{examiner.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(examiner.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {examiners.length === 0 && (
        <div className="mt-4 text-center text-gray-500">
          <p>No examiners registered yet.</p>
          <p className="text-sm mt-2">Examiners can register through the registration page.</p>
        </div>
      )}
    </div>
  )
}
