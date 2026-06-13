import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import { productsAPI } from '../api/app';
import ProductTable from '../components/ProductTable';
import ProductForm from '../components/ProductForm';
import Pagination from '../components/Pagination';
import LoadingSkeleton from '../components/LoadingSkeleton';
import '../styles/AdminProducts.css';

const emptyLookups = {
  brands: [],
  categories: [],
  colors: [],
  sizes: [],
};

const asText = (value) => (typeof value === 'string' ? value : '');
const asNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeImages = (images) =>
  (Array.isArray(images) ? images : [])
    .map((image, index) => ({
      id: image?.id ?? null,
      url: asText(image?.url ?? image),
      sortOrder: asNumber(image?.sortOrder, index),
    }))
    .filter((image) => image.url);

const getVariants = (product) => {
  if (Array.isArray(product?.variants)) return product.variants;
  if (Array.isArray(product?.productVariants)) return product.productVariants;
  return [];
};

const normalizeProduct = (product) => {
  const variants = getVariants(product).map((variant, index) => ({
    clientId: variant?.id ? `variant-${variant.id}` : `variant-new-${index}`,
    id: variant?.id ?? null,
    colorId: variant?.colorId ?? '',
    sizeId: variant?.sizeId ?? '',
    sku: asText(variant?.sku),
    price: asNumber(variant?.price),
    stock: asNumber(variant?.stock),
    isAvailable: variant?.isAvailable !== false,
    images: normalizeImages(variant?.images),
  }));

  return {
    id: product?.id ?? null,
    name: asText(product?.name),
    description: asText(product?.description),
    brandId: product?.brandId ?? '',
    categoryId: product?.categoryId ?? '',
    mainImageUrl: asText(product?.mainImageUrl),
    material: asText(product?.material),
    careInstructions: asText(product?.careInstructions),
    isFeatured: product?.isFeatured === true,
    isAvailable: product?.isAvailable !== false,
    images: normalizeImages(product?.images),
    variants,
    brandName: asText(product?.brandName ?? product?.brand),
    categoryName: asText(product?.categoryName ?? product?.category),
  };
};

const buildLookupMap = (items) =>
  new Map((Array.isArray(items) ? items : []).map((item) => [String(item.id), item]));

const getProductStatus = (product) => {
  const variants = getVariants(product);
  const totalStock = variants.reduce((sum, variant) => sum + asNumber(variant?.stock), 0);

  if (product?.isAvailable === false) return 'inactive';
  if (variants.length === 0 || totalStock === 0) return 'outOfStock';
  if (totalStock <= 10) return 'lowStock';
  return 'available';
};

export default function AdminProducts() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { id: productId } = useParams();
  const { addNotification } = useNotification();

  const isListView = !pathname.includes('/new') && !pathname.includes('/edit');
  const isEditing = pathname.includes('/edit');

  const [products, setProducts] = useState([]);
  const [lookups, setLookups] = useState(emptyLookups);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const brandMap = useMemo(() => buildLookupMap(lookups.brands), [lookups.brands]);
  const categoryMap = useMemo(() => buildLookupMap(lookups.categories), [lookups.categories]);
  const colorMap = useMemo(() => buildLookupMap(lookups.colors), [lookups.colors]);
  const sizeMap = useMemo(() => buildLookupMap(lookups.sizes), [lookups.sizes]);

  const fetchLookups = useCallback(async () => {
    const [brands, categories, colors, sizes] = await Promise.all([
      productsAPI.getBrands(),
      productsAPI.getCategories(),
      productsAPI.getColors(),
      productsAPI.getSizes(),
    ]);

    setLookups({ brands, categories, colors, sizes });
  }, []);

  const fetchProducts = useCallback(async () => {
    const productData = await productsAPI.getProducts();
    setProducts(productData.map(normalizeProduct));
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        await fetchLookups();
        if (isListView) {
          await fetchProducts();
        }
      } catch (error) {
        if (mounted) addNotification(error.message || 'Không thể tải dữ liệu sản phẩm.', 'error');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [addNotification, fetchLookups, fetchProducts, isListView]);

  useEffect(() => {
    if (!isEditing || !productId) {
      setSelectedProduct(null);
      return;
    }

    let mounted = true;
    const loadProduct = async () => {
      try {
        setFormLoading(true);
        const product = await productsAPI.getProduct(productId);
        if (mounted) setSelectedProduct(normalizeProduct(product));
      } catch (error) {
        if (mounted) {
          addNotification(error.message || 'Không thể tải sản phẩm.', 'error');
          navigate('/admin/products');
        }
      } finally {
        if (mounted) setFormLoading(false);
      }
    };

    loadProduct();
    return () => {
      mounted = false;
    };
  }, [addNotification, isEditing, navigate, productId]);

  const enrichedProducts = useMemo(
    () =>
      products.map((product) => ({
        ...product,
        brandName: brandMap.get(String(product.brandId))?.name || product.brandName || '-',
        categoryName: categoryMap.get(String(product.categoryId))?.name || product.categoryName || '-',
      })),
    [brandMap, categoryMap, products]
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return enrichedProducts.filter((product) => {
      if (normalizedQuery) {
        const skus = product.variants.map((variant) => variant.sku).join(' ');
        const haystack = `${product.name} ${product.brandName} ${product.categoryName} ${skus}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }

      if (brandFilter !== 'all' && String(product.brandId) !== brandFilter) return false;
      if (categoryFilter !== 'all' && String(product.categoryId) !== categoryFilter) return false;
      if (statusFilter !== 'all' && getProductStatus(product) !== statusFilter) return false;

      return true;
    });
  }, [brandFilter, categoryFilter, enrichedProducts, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = useMemo(
    () => filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [currentPage, filteredProducts, itemsPerPage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [query, brandFilter, categoryFilter, statusFilter, itemsPerPage]);

  const handleSubmit = useCallback(
    async (payload) => {
      try {
        setFormLoading(true);
        if (isEditing) {
          await productsAPI.updateProduct(productId, payload);
          addNotification('Cập nhật sản phẩm thành công.', 'success');
        } else {
          await productsAPI.createProduct(payload);
          addNotification('Tạo sản phẩm thành công.', 'success');
        }
        navigate('/admin/products');
      } catch (error) {
        addNotification(error.message || 'Không thể lưu sản phẩm.', 'error');
      } finally {
        setFormLoading(false);
      }
    },
    [addNotification, isEditing, navigate, productId]
  );

  const handleDelete = useCallback(
    async (id) => {
      if (!window.confirm('Bạn chắc chắn muốn xóa sản phẩm này?')) return;

      try {
        await productsAPI.deleteProduct(id);
        await fetchProducts();
        addNotification('Đã xóa sản phẩm.', 'success');
      } catch (error) {
        addNotification(error.message || 'Không thể xóa sản phẩm.', 'error');
      }
    },
    [addNotification, fetchProducts]
  );

  const clearFilters = useCallback(() => {
    setQuery('');
    setBrandFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
  }, []);

  if (loading || (isEditing && formLoading && !selectedProduct)) {
    return <LoadingSkeleton type="content" />;
  }

  if (!isListView) {
    return (
      <div className="admin-products-page">
        <ProductForm
          initialProduct={selectedProduct}
          isEditing={isEditing}
          isSaving={formLoading}
          lookups={lookups}
          lookupMaps={{ brandMap, categoryMap, colorMap, sizeMap }}
          onCancel={() => navigate('/admin/products')}
          onSubmit={handleSubmit}
        />
      </div>
    );
  }

  return (
    <div className="admin-products-page">
      <div className="pm-header">
        <div>
          <p className="pm-kicker">Product Management</p>
          <h1>Sản phẩm</h1>
          <span>{filteredProducts.length} sản phẩm đang hiển thị</span>
        </div>
        <button className="pm-button pm-button-primary" onClick={() => navigate('/admin/products/new')}>
          Thêm sản phẩm
        </button>
      </div>

      <div className="pm-toolbar">
        <input
          aria-label="Tìm sản phẩm"
          className="pm-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm theo tên, SKU, thương hiệu, danh mục..."
        />
        <select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>
          <option value="all">Tất cả thương hiệu</option>
          {lookups.brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="all">Tất cả danh mục</option>
          {lookups.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="available">Đang bán</option>
          <option value="lowStock">Sắp hết</option>
          <option value="outOfStock">Hết hàng</option>
          <option value="inactive">Tạm ẩn</option>
        </select>
        <button className="pm-button pm-button-secondary" onClick={clearFilters}>
          Xóa lọc
        </button>
      </div>

      <ProductTable
        products={paginatedProducts}
        getProductStatus={getProductStatus}
        onView={(id) => navigate(`/products/${id}`)}
        onEdit={(id) => navigate(`/admin/products/${id}/edit`)}
        onDelete={handleDelete}
      />

      {filteredProducts.length === 0 && (
        <div className="pm-empty">
          <h3>Chưa có sản phẩm phù hợp</h3>
          <p>Thay đổi bộ lọc hoặc thêm sản phẩm mới để bắt đầu quản lý kho.</p>
        </div>
      )}

      {filteredProducts.length > itemsPerPage && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          setItemsPerPage={setItemsPerPage}
          setCurrentPage={setCurrentPage}
          totalItems={filteredProducts.length}
        />
      )}
    </div>
  );
}
