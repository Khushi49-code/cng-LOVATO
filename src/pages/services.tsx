import type { NextPage } from 'next';
import MainLayout from '../components/layouts/MainLayout';
import ServiceMaster from '../components/modules/ServiceMaster';

const ServicesPage: NextPage = () => {
  return (
    <MainLayout>
      <ServiceMaster />
    </MainLayout>
  );
};

export default ServicesPage;