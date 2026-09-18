import type { NextPage } from 'next';
import MainLayout from '../components/layouts/MainLayout';
import SalesAssignment from '../components/modules/SalesAssignment'; // DEFAULT import

const SalesPage: NextPage = () => {
  return (
    <MainLayout>
      <SalesAssignment />
    </MainLayout>
  );
};

export default SalesPage;