import { useCompany } from '../contexts/CompanyContext';

export default function Dashboard() {
  const { currentCompany } = useCompany();

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-3xl font-bold mb-2">Welcome to Sync ERP</h1>
        <p className="text-primary-100 text-lg">
          {currentCompany ? `Managing ${currentCompany.name}` : 'Select a company to get started'}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Sales Orders"
          value="0"
          change="+0%"
          icon="📊"
          color="from-blue-400 to-blue-600"
        />
        <StatCard
          title="Purchase Orders"
          value="0"
          change="+0%"
          icon="📦"
          color="from-green-400 to-green-600"
        />
        <StatCard
          title="Invoices"
          value="0"
          change="+0%"
          icon="📄"
          color="from-yellow-400 to-orange-500"
        />
        <StatCard
          title="Bills To Pay"
          value="0"
          change="+0%"
          icon="🧾"
          color="from-rose-400 to-rose-600"
        />
        <StatCard
          title="Products"
          value="0"
          change="+0%"
          icon="🏷️"
          color="from-purple-400 to-purple-600"
        />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 card-hover">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Getting Started</h2>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>Create your first company</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-gray-300">○</span>
              <span>Add products and services</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-gray-300">○</span>
              <span>Set up customers and suppliers</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-gray-300">○</span>
              <span>Create your first order</span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 card-hover">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
          <p className="text-gray-500 text-center py-8">No recent activity</p>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  icon: string;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 card-hover">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
        <div
          className={`w-12 h-12 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center text-2xl`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
