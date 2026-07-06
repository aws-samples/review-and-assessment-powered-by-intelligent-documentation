import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

/**
 * アプリケーションの共通レイアウト
 * サイドバーとメインコンテンツエリアを含む
 */
export default function Layout() {
  return (
    <div className="flex min-h-screen bg-aws-paper-light">
      <Sidebar />
      
      {/* メインコンテンツエリア */}
      <main className="min-w-0 flex-1 p-8 transition-all duration-300 md:ml-64">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
