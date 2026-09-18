import type { NextPage } from 'next';
import MainLayout from '../components/layouts/MainLayout';
import ProductMaster from '../components/modules/ProductMaster';

const ProductsPage: NextPage = () => {
  return (
    <MainLayout>
      <ProductMaster />
    </MainLayout>
  );
};

export default ProductsPage;