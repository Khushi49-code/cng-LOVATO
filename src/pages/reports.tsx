import type { NextPage } from 'next';
import MainLayout from '../components/layouts/MainLayout';
import ReportsModule from '../components/modules/ReportsModule';

const ReportsPage: NextPage = () => {
  return (
    <MainLayout>
      <ReportsModule />
    </MainLayout>
  );
};

export default ReportsPage;