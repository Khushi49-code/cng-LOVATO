import type { NextPage } from 'next';
import MainLayout from '../components/layouts/MainLayout';
import CustomerManagement from '../components/modules/CustomerManagement';

const CustomersPage: NextPage = () => {
  return (
    <MainLayout>
      <CustomerManagement />
    </MainLayout>
  );
};

export default CustomersPage;