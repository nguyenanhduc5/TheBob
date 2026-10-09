import { useCallback, useEffect, useMemo, useState } from 'react';
import { collectionsAPI, productsAPI } from '../../../api/app';
import { useNotification } from '../../../context/NotificationContext';

const EMPTY_FORM = {
  name: '',
  subtitle: '',
  description: '',
  imageUrl: '',
  isActive: true,
  sortOrder: 0,
  productIds: [],
};

const normalizeSearchText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLocaleLowerCase('vi');

const getCollectionErrorMessage = (error, fallback) => (
  error?.payload?.errors?.innerException
  || error?.payload?.errors?.message
  || error?.message
  || fallback
);

export default function AdminCollectionsPanel() {
  const { addNotification } = useNotification();
  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutMode, setLayoutMode] = useState('staggered');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [collectionItems, productItems, layout] = await Promise.all([
        collectionsAPI.getAdminAll(),
        productsAPI.getProducts(),
        collectionsAPI.getLayout().catch(() => ({ layoutMode: 'staggered' })),
      ]);
      setCollections(collectionItems);
      setProducts(productItems);
      setLayoutMode(layout?.layoutMode === 'two-column' ? 'two-column' : 'staggered');
    } catch (error) {
      addNotification(getCollectionErrorMessage(error, 'Không thể tải dữ liệu bộ sưu tập.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { loadData(); }, [loadData]);

  const productById = useMemo(
    () => new Map(products.map((product) => [String(product.id), product])),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const keyword = normalizeSearchText(search.trim());
    if (!keyword) return products;
    return products.filter((product) => [
      product.name,
      product.sku,
      product.categoryName || product.category,
      product.brandName || product.brand,
    ].some((value) => normalizeSearchText(value).includes(keyword)));
  }, [products, search]);

  const searchSuggestions = useMemo(() => {
    const keyword = normalizeSearchText(search.trim());
    if (!keyword) return [];

    return [...filteredProducts]
      .sort((first, second) => {
        const score = (product) => {
          const name = normalizeSearchText(product.name);
          const sku = normalizeSearchText(product.sku);
          if (name.startsWith(keyword)) return 0;
          if (sku.startsWith(keyword)) return 1;
          if (name.includes(keyword)) return 2;
          return 3;
        };
        return score(first) - score(second);
      })
      .slice(0, 8);
  }, [filteredProducts, search]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSearch('');
    setSearchFocused(false);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (collection) => {
    setEditingId(collection.id);
    setForm({
      name: collection.name || '',
      subtitle: collection.subtitle || '',
      description: collection.description || '',
      imageUrl: collection.imageUrl || '',
      isActive: collection.isActive !== false,
      sortOrder: Number(collection.sortOrder) || 0,
      productIds: Array.from(collection.productIds || []).map(Number).filter(Boolean),
    });
    setSearch('');
    setSearchFocused(false);
    setShowForm(true);
  };

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleProduct = (productId) => {
    const normalizedId = Number(productId);
    setForm((current) => ({
      ...current,
      productIds: current.productIds.includes(normalizedId)
        ? current.productIds.filter((id) => id !== normalizedId)
        : [...current.productIds, normalizedId],
    }));
  };

  const selectSuggestedProduct = (productId) => {
    const normalizedId = Number(productId);
    if (!form.productIds.includes(normalizedId)) toggleProduct(normalizedId);
    setSearch('');
    setSearchFocused(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      addNotification('Vui lòng nhập tên bộ sưu tập.', 'warning');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...form,
        name: form.name.trim(),
        subtitle: form.subtitle.trim(),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editingId) await collectionsAPI.update(editingId, payload);
      else await collectionsAPI.create(payload);
      addNotification(editingId ? 'Đã cập nhật bộ sưu tập.' : 'Đã thêm bộ sưu tập.', 'success');
      closeForm();
      await loadData();
    } catch (error) {
      addNotification(getCollectionErrorMessage(error, 'Không thể lưu bộ sưu tập.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (collection) => {
    if (!window.confirm(`Xóa bộ sưu tập “${collection.name}”?`)) return;
    try {
      await collectionsAPI.delete(collection.id);
      addNotification('Đã xóa bộ sưu tập.', 'success');
      await loadData();
    } catch (error) {
      addNotification(getCollectionErrorMessage(error, 'Không thể xóa bộ sưu tập.'), 'error');
    }
  };

  const changeLayoutMode = async (nextLayoutMode) => {
    if (layoutSaving || nextLayoutMode === layoutMode) return;

    const previousLayoutMode = layoutMode;
    setLayoutMode(nextLayoutMode);
    setLayoutSaving(true);

    try {
      await collectionsAPI.updateLayout(nextLayoutMode);
      addNotification('Đã cập nhật kiểu hiển thị bộ sưu tập.', 'success');
    } catch (error) {
      setLayoutMode(previousLayoutMode);
      addNotification(getCollectionErrorMessage(error, 'Không thể cập nhật kiểu hiển thị.'), 'error');
    } finally {
      setLayoutSaving(false);
    }
  };

  if (loading) return <div className="collection-admin-loading">Đang tải bộ sưu tập...</div>;

  return (
    <section className="admin-collections-panel">
      <div className="admin-header collection-admin-header">
        <div>
          <h1>Quản lý bộ sưu tập</h1>
          <p>Nhóm nhiều sản phẩm để hiển thị tại trang Bộ sưu tập.</p>
        </div>
        <button type="button" className="btn-add-category" onClick={showForm ? closeForm : openCreate}>
          {showForm ? 'Quay lại' : '+ Thêm bộ sưu tập'}
        </button>
      </div>

      <div className="collection-layout-settings">
        <div>
          <strong>Kiểu hiển thị ngoài website</strong>
          <p>Áp dụng chung cho toàn bộ trang bộ sưu tập.</p>
        </div>
        <div className="collection-layout-options" role="group" aria-label="Kiểu hiển thị bộ sưu tập">
          <button
            type="button"
            className={layoutMode === 'staggered' ? 'active' : ''}
            aria-pressed={layoutMode === 'staggered'}
            disabled={layoutSaving}
            onClick={() => changeLayoutMode('staggered')}
          >
            <span className="collection-layout-preview collection-layout-preview--staggered" aria-hidden="true">
              <i /><i /><i />
            </span>
            <span><b>So le</b><small>Bố cục nổi bật hiện tại</small></span>
          </button>
          <button
            type="button"
            className={layoutMode === 'two-column' ? 'active' : ''}
            aria-pressed={layoutMode === 'two-column'}
            disabled={layoutSaving}
            onClick={() => changeLayoutMode('two-column')}
          >
            <span className="collection-layout-preview collection-layout-preview--two-column" aria-hidden="true">
              <i /><i />
            </span>
            <span><b>Hai cột ngang</b><small>2 bộ sưu tập mỗi hàng</small></span>
          </button>
        </div>
      </div>

      {showForm ? (
        <form className="collection-admin-form" onSubmit={handleSubmit}>
          <div className="collection-form-heading">
            <div>
              <h2>{editingId ? 'Chỉnh sửa bộ sưu tập' : 'Thêm bộ sưu tập mới'}</h2>
              <p>Sản phẩm được hiển thị theo đúng thứ tự bạn chọn.</p>
            </div>
            <span>{form.productIds.length} sản phẩm đã chọn</span>
          </div>

          <div className="collection-form-grid">
            <label className="form-group">
              <span>Tên bộ sưu tập *</span>
              <input value={form.name} onChange={(event) => setField('name', event.target.value)} maxLength={160} required />
            </label>
            <label className="form-group">
              <span>Tiêu đề phụ</span>
              <input value={form.subtitle} onChange={(event) => setField('subtitle', event.target.value)} maxLength={200} placeholder="Ví dụ: STREET MINIMALISM" />
            </label>
            <label className="form-group collection-form-wide">
              <span>Mô tả</span>
              <textarea value={form.description} onChange={(event) => setField('description', event.target.value)} rows={4} maxLength={1200} />
            </label>
            <label className="form-group collection-form-wide">
              <span>Đường dẫn ảnh bìa</span>
              <input type="url" value={form.imageUrl} onChange={(event) => setField('imageUrl', event.target.value)} maxLength={2000} placeholder="https://..." />
            </label>
            <label className="form-group">
              <span>Thứ tự hiển thị</span>
              <input type="number" value={form.sortOrder} onChange={(event) => setField('sortOrder', event.target.value)} />
            </label>
            <label className="collection-active-toggle">
              <input type="checkbox" checked={form.isActive} onChange={(event) => setField('isActive', event.target.checked)} />
              <span>Hiển thị ngoài website</span>
            </label>
          </div>

          {form.imageUrl && (
            <div className="collection-cover-preview"><img src={form.imageUrl} alt="Xem trước ảnh bìa" /></div>
          )}

          <div className="collection-product-picker">
            <div className="collection-picker-toolbar">
              <div>
                <h3>Gắn sản phẩm</h3>
                <p>Nhấn vào sản phẩm để chọn hoặc bỏ chọn.</p>
              </div>
              <div className="collection-search-box">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                  placeholder="Tìm tên, SKU, danh mục, thương hiệu..."
                  autoComplete="off"
                />
                {searchFocused && search.trim() && (
                  <div className="collection-search-suggestions" role="listbox">
                    {searchSuggestions.length > 0 ? searchSuggestions.map((product) => {
                      const selected = form.productIds.includes(Number(product.id));
                      return (
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          key={product.id}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectSuggestedProduct(product.id)}
                        >
                          <img src={product.mainImageUrl || '/placeholder.jpg'} alt="" />
                          <span>
                            <strong>{product.name}</strong>
                            <small>{[product.sku, product.categoryName || product.category].filter(Boolean).join(' · ')}</small>
                          </span>
                          <i>{selected ? 'Đã chọn' : 'Chọn'}</i>
                        </button>
                      );
                    }) : (
                      <p>Không tìm thấy sản phẩm phù hợp.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {form.productIds.length > 0 && (
              <div className="collection-selected-strip">
                {form.productIds.map((id, index) => {
                  const product = productById.get(String(id));
                  if (!product) return null;
                  return (
                    <button type="button" key={id} onClick={() => toggleProduct(id)} title="Bỏ sản phẩm khỏi bộ sưu tập">
                      <span>{index + 1}</span>
                      <img src={product.mainImageUrl || '/placeholder.jpg'} alt="" />
                      <strong>{product.name}</strong>
                      <b>×</b>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="collection-product-list-heading">
              <strong>{search.trim() ? `Kết quả (${filteredProducts.length})` : `Tất cả sản phẩm hiện có (${products.length})`}</strong>
              {search.trim() && <button type="button" onClick={() => setSearch('')}>Xóa tìm kiếm</button>}
            </div>

            {filteredProducts.length > 0 ? <div className="collection-product-grid">
              {filteredProducts.map((product) => {
                const selected = form.productIds.includes(Number(product.id));
                return (
                  <button
                    type="button"
                    key={product.id}
                    className={selected ? 'selected' : ''}
                    onClick={() => toggleProduct(product.id)}
                  >
                    <img src={product.mainImageUrl || '/placeholder.jpg'} alt={product.name} />
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.sku || product.categoryName || product.category || 'Sản phẩm'}</small>
                    </span>
                    <i>{selected ? '✓' : '+'}</i>
                  </button>
                );
              })}
            </div> : <div className="collection-product-empty">Không có sản phẩm phù hợp với từ khóa.</div>}
          </div>

          <div className="form-actions collection-form-actions">
            <button type="button" className="btn-cancel" onClick={closeForm}>Hủy</button>
            <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu bộ sưu tập'}</button>
          </div>
        </form>
      ) : collections.length === 0 ? (
        <div className="no-categories">Chưa có bộ sưu tập nào.</div>
      ) : (
        <div className="collection-admin-grid">
          {collections.map((collection) => (
            <article key={collection.id} className="collection-admin-card">
              <img src={collection.imageUrl || '/placeholder.jpg'} alt={collection.name} />
              <div className="collection-admin-card-body">
                <div className="collection-card-status-row">
                  <span className={collection.isActive ? 'active' : 'hidden'}>{collection.isActive ? 'Đang hiển thị' : 'Đang ẩn'}</span>
                  <small>{collection.productCount || 0} sản phẩm</small>
                </div>
                <h3>{collection.name}</h3>
                <p>{collection.subtitle || collection.description || 'Chưa có mô tả'}</p>
                <div className="category-actions">
                  <button type="button" className="btn-edit" onClick={() => openEdit(collection)}>Sửa & gắn sản phẩm</button>
                  <button type="button" className="btn-delete" onClick={() => handleDelete(collection)}>Xóa</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
