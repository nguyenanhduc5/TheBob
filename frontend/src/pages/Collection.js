import { Link } from 'react-router-dom';
import './CollectionList.css'; // File CSS cho trang danh mục

const collections = [
  { id: 'summer26-2', name: 'SUMMER26 DROP 2', image: '/images/summer2.jpg' },
  { id: 'summer26-1', name: 'SUMMER26 DROP 1', image: '/images/summer1.jpg' },
  { id: 'igifms', name: '“IGIFMS” COLLECTION', image: '/images/igifms.jpg' },
  { id: 'legacy', name: 'SSMA "LEGACY" DROP', image: '/images/legacy.jpg' },
];

export default function CollectionList() {
  return (
    <div className="collections-grid">
      {collections.map((col) => (
        <Link to={`/collections/${col.id}`} key={col.id} className="collection-item">
          <img src={col.image} alt={col.name} />
          <div className="collection-overlay">{col.name}</div>
        </Link>
      ))}
    </div>
  );
}