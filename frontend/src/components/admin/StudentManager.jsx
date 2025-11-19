import { useState, useEffect } from 'react'
import axios from 'axios'

export default function StudentManager() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // 'pending', 'approved', 'all', 'archived'
  const [roleFilter, setRoleFilter] = useState('all') // 'all', 'student', 'examiner'
  const [institutionFilter, setInstitutionFilter] = useState('all') // 'all' or specific institution
  const [stats, setStats] = useState({
    totalStudents: 0,
    pendingStudents: 0,
    totalExaminers: 0,
    pendingExaminers: 0,
    archivedStudents: 0
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      // Fetch all users to calculate stats
      const response = await axios.get('/api/admin/users')
      const allUsers = response.data.users

      // Calculate stats
      const studentUsers = allUsers.filter(u => u.role === 'student')
      const examinerUsers = allUsers.filter(u => u.role === 'examiner')

      setStats({
        totalStudents: studentUsers.length,
        pendingStudents: studentUsers.filter(u => !u.isApproved && !u.isArchived).length,
        totalExaminers: examinerUsers.length,
        pendingExaminers: examinerUsers.filter(u => !u.isApproved && !u.isArchived).length,
        archivedStudents: studentUsers.filter(u => u.isArchived).length
      })

      setUsers(allUsers)
    } catch (error) {
      console.error('Error fetching users:', error)
      alert('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId) => {
    if (!window.confirm('Are you sure you want to approve this account?')) {
      return
    }

    try {
      await axios.patch(`/api/admin/users/${userId}/approve`)
      alert('User approved successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error approving user:', error)
      alert('Failed to approve user')
    }
  }

  const handleRevoke = async (userId) => {
    if (!window.confirm('Are you sure you want to revoke approval for this account?')) {
      return
    }

    try {
      await axios.patch(`/api/admin/users/${userId}/revoke`)
      alert('Approval revoked successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error revoking approval:', error)
      alert('Failed to revoke approval')
    }
  }

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      await axios.delete(`/api/admin/users/${userId}`)
      alert('User deleted successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user')
    }
  }

  const handleArchive = async (userId) => {
    if (!window.confirm('Archive this student? They will still be searchable for performance history.')) {
      return
    }

    try {
      await axios.patch(`/api/admin/users/${userId}/archive`)
      alert('Student archived successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error archiving user:', error)
      alert('Failed to archive student')
    }
  }

  const handleUnarchive = async (userId) => {
    if (!window.confirm('Unarchive this student?')) {
      return
    }

    try {
      await axios.patch(`/api/admin/users/${userId}/unarchive`)
      alert('Student unarchived successfully')
      fetchUsers()
    } catch (error) {
      console.error('Error unarchiving user:', error)
      alert('Failed to unarchive student')
    }
  }

  // Get unique institutions for filter
  const institutions = [...new Set(users.map(u => u.institution).filter(Boolean))]

  // Filter users based on current filters
  const filteredUsers = users.filter(user => {
    // Filter by role
    if (roleFilter !== 'all' && user.role !== roleFilter) {
      return false
    }

    // Filter by institution
    if (institutionFilter !== 'all' && user.institution !== institutionFilter) {
      return false
    }

    // Filter by archive/approval status
    if (filter === 'archived') {
      return user.isArchived
    }

    // For non-archived views, exclude archived users
    if (user.isArchived && filter !== 'archived') {
      return false
    }

    if (filter === 'pending' && user.isApproved) {
      return false
    }
    if (filter === 'approved' && !user.isApproved) {
      return false
    }

    // Don't show admins in the list
    if (user.role === 'admin') {
      return false
    }

    return true
  })

  if (loading) {
    return <div>Loading users...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Manage Users</h2>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Pending Students</div>
            <div className="text-3xl font-bold text-yellow-600">{stats.pendingStudents}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Total Students</div>
            <div className="text-3xl font-bold text-blue-600">{stats.totalStudents}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Archived Students</div>
            <div className="text-3xl font-bold text-gray-600">{stats.archivedStudents}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Pending Examiners</div>
            <div className="text-3xl font-bold text-orange-600">{stats.pendingExaminers}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Total Examiners</div>
            <div className="text-3xl font-bold text-indigo-600">{stats.totalExaminers}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-4">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setFilter('pending')}
                className={`${
                  filter === 'pending'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
              >
                Pending Approval ({stats.pendingStudents + stats.pendingExaminers})
              </button>
              <button
                onClick={() => setFilter('approved')}
                className={`${
                  filter === 'approved'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
              >
                Approved
              </button>
              <button
                onClick={() => setFilter('archived')}
                className={`${
                  filter === 'archived'
                    ? 'border-gray-500 text-gray-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
              >
                Archived ({stats.archivedStudents})
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`${
                  filter === 'all'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
              >
                All Active
              </button>
            </nav>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Filter by Role:</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Roles</option>
              <option value="student">Students Only</option>
              <option value="examiner">Examiners Only</option>
            </select>
          </div>
          {institutions.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">Filter by Institution:</label>
              <select
                value={institutionFilter}
                onChange={(e) => setInstitutionFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Institutions</option>
                {institutions.map(inst => (
                  <option key={inst} value={inst}>{inst}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Users Table */}
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
                Institution
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`flex-shrink-0 h-10 w-10 ${
                        user.role === 'student' ? 'bg-blue-100' : 'bg-indigo-100'
                      } rounded-full flex items-center justify-center`}>
                        <span className={`${
                          user.role === 'student' ? 'text-blue-600' : 'text-indigo-600'
                        } font-medium text-sm`}>
                          {user.firstName[0]}{user.lastName[0]}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.institution || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.role === 'student'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.isArchived ? (
                      <div>
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          Archived
                        </span>
                        {user.archivedDate && (
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(user.archivedDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isApproved
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {user.isApproved ? 'Approved' : 'Pending'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-col gap-1">
                      <div className="flex space-x-2">
                        {user.isArchived ? (
                          <button
                            onClick={() => handleUnarchive(user._id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Unarchive
                          </button>
                        ) : (
                          <>
                            {!user.isApproved ? (
                              <button
                                onClick={() => handleApprove(user._id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Approve
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRevoke(user._id)}
                                className="text-orange-600 hover:text-orange-900"
                              >
                                Revoke
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(user._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                      {user.role === 'student' && !user.isArchived && (
                        <button
                          onClick={() => handleArchive(user._id)}
                          className="text-gray-600 hover:text-gray-900 text-left"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && filter === 'pending' && (
        <div className="mt-4 text-center text-gray-500">
          <p>No pending approvals.</p>
          <p className="text-sm mt-2">All accounts have been reviewed.</p>
        </div>
      )}
    </div>
  )
}
