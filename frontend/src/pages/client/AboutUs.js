import React from 'react';
import { Link } from 'react-router-dom';
import blackImage from '../../images/black.jpg';
import coolImage from '../../images/cool.jpg';
import homyImage from '../../images/homy.jpg';
import kingImage from '../../images/king.jpg';
import whiteTeeImage from '../../images/whitetee.jpg';
import { usePreferences } from '../../context/PreferencesContext';
import '../../styles/AboutUs.css';

const getCollections = (t) => [
  {
    className: 'about-bento-card--feature',
    eyebrow: 'thebob / about',
    title: t('about.card.everyday.title'),
    description: t('about.card.everyday.description'),
    image: whiteTeeImage,
    imageAlt: t('about.card.everyday.alt'),
    tag: 'everyday essentials',
    position: 'center 38%',
  },
  {
    className: 'about-bento-card--small about-bento-card--intro',
    eyebrow: 'our point of view',
    title: t('about.card.point.title'),
    description: t('about.card.point.description'),
    tag: 'minimal design',
  },
  {
    className: 'about-bento-card--wide about-bento-card--portrait',
    eyebrow: 'made to be worn',
    title: t('about.card.portrait.title'),
    image: homyImage,
    imageAlt: t('about.card.portrait.alt'),
    tag: 'the everyday edit',
    position: 'center 46%',
  },
  {
    className: 'about-bento-card--wide about-bento-card--story',
    eyebrow: 'behind the bob',
    title: t('about.card.story.title'),
    description: t('about.card.story.description'),
    image: kingImage,
    imageAlt: t('about.card.story.alt'),
    tag: 'our story',
    position: 'center 48%',
  },
  {
    className: 'about-bento-card--small about-bento-card--detail',
    eyebrow: 'the details',
    title: t('about.card.details.title'),
    image: coolImage,
    imageAlt: t('about.card.details.alt'),
    tag: 'built for everyday',
    position: 'center 38%',
  },
  {
    className: 'about-bento-card--small about-bento-card--black',
    eyebrow: 'quiet confidence',
    title: t('about.card.confidence.title'),
    image: blackImage,
    imageAlt: t('about.card.confidence.alt'),
    tag: 'thebob essentials',
    position: 'center 40%',
  },
];

function AboutCard({ card }) {
  return (
    <Link
      to="/products"
      className={`about-bento-card ${card.className}`}
      aria-label={`${card.title.replace('\n', ' ')} — khám phá sản phẩm THEBOB`}
    >
      <div className="about-bento-card-heading">
        <span className="about-bento-eyebrow">{card.eyebrow}</span>
        <h2>{card.title}</h2>
        {card.description && <p>{card.description}</p>}
      </div>
      {card.image && (
        <div className="about-bento-preview">
          <img
            src={card.image}
            alt={card.imageAlt}
            style={{ objectPosition: card.position }}
            loading="lazy"
          />
        </div>
      )}
      <span className="about-bento-tag">{card.tag}</span>
      <span className="about-bento-arrow" aria-hidden="true">↗</span>
    </Link>
  );
}

export default function AboutUs() {
  const { t } = usePreferences();
  const collections = getCollections(t);

  return (
    <main className="about-page">
      <title>{t('about.meta.title')}</title>
      <meta
        name="description"
        content={t('about.meta.description')}
      />

      <section className="about-bento-intro" id="about-story" aria-label={t('about.story')}>
        <div>
          <span className="about-bento-eyebrow"><span /> {t('about.intro.eyebrow')}</span>
          <h1 style={{ whiteSpace: 'pre-line' }}>{t('about.intro.title')}</h1>
        </div>
        <p>
          {t('about.intro.description')}
        </p>
      </section>

      <section className="about-bento-grid" id="about-works" aria-label={t('about.discover')}>
        {collections.map((card) => <AboutCard key={card.className} card={card} />)}
        <Link to="/products" className="about-bento-card about-bento-card--cta">
          <span className="about-bento-eyebrow">find your everyday</span>
          <h2 style={{ whiteSpace: 'pre-line' }}>{t('about.card.cta.title')}</h2>
          <span className="about-bento-tag">{t('about.card.cta')}</span>
          <span className="about-bento-arrow" aria-hidden="true">↗</span>
        </Link>
      </section>
    </main>
  );
}
