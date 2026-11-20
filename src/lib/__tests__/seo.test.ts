import { BUILDING_CATALOG, type PublicBuildingType } from '@/lib/buildingCatalog'
import {
  absoluteUrl,
  buildArticleJsonLd,
  buildBlogJsonLd,
  buildBreadcrumbJsonLd,
  buildBuildingServicesJsonLd,
  buildBusinessReferenceJsonLd,
  buildContactPageJsonLd,
  buildPageMetadata,
  buildServiceAreaBusinessJsonLd,
  buildServiceAreaServiceJsonLd,
  buildWebsiteJsonLd,
  BUSINESS_SCHEMA_TYPE,
  canonicalHost,
  DEFAULT_SITE_URL,
  getSiteUrl,
  serializeJsonLd,
} from '@/lib/seo'

describe('seo helpers', () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
    }
  })

  it('falls back to default site URL when NEXT_PUBLIC_SITE_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    expect(getSiteUrl()).toBe(DEFAULT_SITE_URL)
    expect(canonicalHost()).toBe('www.shed210.com')
  })

  it('falls back to default site URL when NEXT_PUBLIC_SITE_URL is invalid', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'not-a-url'
    expect(getSiteUrl()).toBe(DEFAULT_SITE_URL)
    expect(canonicalHost()).toBe('www.shed210.com')
  })

  it('normalizes site URL and host when NEXT_PUBLIC_SITE_URL is valid', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.shed210.com/some/path?x=1'
    expect(getSiteUrl()).toBe('https://www.shed210.com')
    expect(canonicalHost()).toBe('www.shed210.com')
    expect(absoluteUrl('/news')).toBe('https://www.shed210.com/news')
  })

  it('builds canonical page metadata', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.shed210.com'

    const metadata = buildPageMetadata({
      title: 'Custom Sheds San Antonio',
      description: 'Description',
      path: '/quote',
      imageAlt: 'Quote calculator',
    })

    expect(metadata.alternates?.canonical).toBe('/quote')
    expect(metadata.openGraph?.url).toBe('https://www.shed210.com/quote')
  })

  it('builds service-area business JSON-LD without a public street address', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.shed210.com'

    const jsonLd = buildServiceAreaBusinessJsonLd({ areaServed: ['San Antonio'] })
    const serialized = JSON.stringify(jsonLd)

    expect(jsonLd['@type']).toBe('HomeAndConstructionBusiness')
    expect(jsonLd['@type']).toBe(BUSINESS_SCHEMA_TYPE)
    expect(jsonLd['@id']).toBe('https://www.shed210.com/#localbusiness')
    expect(jsonLd.url).toBe('https://www.shed210.com/')
    expect(jsonLd.mainEntityOfPage).toBe('https://www.shed210.com/')
    expect(jsonLd.alternateName).toEqual(['Shed 210'])
    expect(jsonLd.hasMap).toBe(
      'https://www.google.com/maps/place/?q=place_id:ChIJueBVkBv3XIYR6eSUXgDTEv8'
    )
    expect(jsonLd).not.toHaveProperty('address')
    expect(serialized).not.toContain('streetAddress')
    expect(serialized).toContain('San Antonio')
    expect(jsonLd).not.toHaveProperty('logo')
    expect(jsonLd).not.toHaveProperty('aggregateRating')
    expect(jsonLd.sameAs).toEqual([
      'https://www.google.com/maps/place/?q=place_id:ChIJueBVkBv3XIYR6eSUXgDTEv8',
      'https://www.facebook.com/shed210/',
    ])
    expect(serialized).not.toContain('share.google')
    expect(serialized).not.toContain('facebook.com/share')
  })

  it('lists every public building type as an offered service', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.shed210.com'

    const jsonLd = buildServiceAreaBusinessJsonLd({ areaServed: ['San Antonio', 'Boerne'] })
    const catalog = jsonLd.hasOfferCatalog as { itemListElement: { itemOffered: Record<string, unknown> }[] }
    const services = catalog.itemListElement.map((offer) => offer.itemOffered)

    expect(services.map((service) => service.name)).toEqual([
      ...BUILDING_CATALOG.map((building) => building.title),
      'Shed planning for HOA requirements',
    ])
    expect(services[0]).toMatchObject({
      '@type': 'Service',
      '@id': 'https://www.shed210.com/buildings#storage_shed',
      url: 'https://www.shed210.com/buildings#storage_shed',
      description: BUILDING_CATALOG[0].summary,
    })
    // Cities live once on the business, not repeated under every service.
    expect(services.every((service) => !('areaServed' in service))).toBe(true)
    expect(jsonLd.areaServed).toHaveLength(2)
  })

  it('names every public building type in the hand-written business description', () => {
    // Adding a building type fails here until the description mentions it.
    const descriptionTerms: Record<PublicBuildingType, string> = {
      storage_shed: 'metal storage sheds and garages',
      greenhouse: 'polycarbonate greenhouses',
      well_pump: 'water well sheds',
      open_loafing: 'loafing sheds',
      carport: 'carports',
    }
    const description = buildServiceAreaBusinessJsonLd().description as string

    for (const building of BUILDING_CATALOG) {
      expect(description).toContain(descriptionTerms[building.value])
    }
    expect(description).not.toMatch(/metal greenhouse/i)
  })

  it('references the business by type, id, name, and url only', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.shed210.com'

    expect(buildBusinessReferenceJsonLd()).toEqual({
      '@type': 'HomeAndConstructionBusiness',
      '@id': 'https://www.shed210.com/#localbusiness',
      name: 'Shed210',
      url: 'https://www.shed210.com/',
    })
  })

  it('builds a city Service that points at the business instead of redefining it', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.shed210.com'

    const jsonLd = buildServiceAreaServiceJsonLd({
      path: '/service-area/boerne',
      name: 'Custom sheds in Boerne, Texas',
      description: 'Plan a shed in Boerne.',
      area: { city: 'Boerne', regionName: 'Texas', countryCode: 'US' },
    })

    expect(jsonLd).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': 'https://www.shed210.com/service-area/boerne#service',
      name: 'Custom sheds in Boerne, Texas',
      description: 'Plan a shed in Boerne.',
      url: 'https://www.shed210.com/service-area/boerne',
      serviceType: 'Custom shed building',
      areaServed: {
        '@type': 'City',
        name: 'Boerne',
        containedInPlace: { '@type': 'State', name: 'Texas' },
      },
      provider: buildBusinessReferenceJsonLd(),
    })
  })

  it('builds a ContactPage whose main entity is the business reference', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.shed210.com'

    expect(buildContactPageJsonLd({
      path: '/contact',
      name: 'Contact Shed Builders in San Antonio',
      description: 'Call or text.',
    })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      '@id': 'https://www.shed210.com/contact',
      name: 'Contact Shed Builders in San Antonio',
      description: 'Call or text.',
      url: 'https://www.shed210.com/contact',
      mainEntity: buildBusinessReferenceJsonLd(),
    })
  })

  it('builds a buildings ItemList whose services point back to the business', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.shed210.com'

    const jsonLd = buildBuildingServicesJsonLd()
    const items = jsonLd.itemListElement as { position: number; item: Record<string, unknown> }[]

    expect(jsonLd['@type']).toBe('ItemList')
    expect(items).toHaveLength(BUILDING_CATALOG.length)
    expect(items.map((entry) => entry.position)).toEqual(
      BUILDING_CATALOG.map((_, index) => index + 1)
    )
    expect(items[1].item).toMatchObject({
      '@type': 'Service',
      '@id': 'https://www.shed210.com/buildings#greenhouse',
      name: 'Greenhouses',
      serviceType: 'Greenhouse',
      provider: {
        '@type': 'HomeAndConstructionBusiness',
        '@id': 'https://www.shed210.com/#localbusiness',
      },
    })
  })

  it('builds a Blog with one BlogPosting per article', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.shed210.com'

    const jsonLd = buildBlogJsonLd({
      name: 'Shed210 Guides',
      description: 'Guides',
      articles: [
        { slug: 'cost', title: 'Cost Guide', excerpt: 'Prices', date: '2026-07-20', modifiedDate: '2026-09-22' },
        { slug: 'permits', title: 'Permit Guide', excerpt: 'Permits', date: '2026-05-15' },
      ],
    })

    expect(jsonLd).toMatchObject({
      '@type': 'Blog',
      '@id': 'https://www.shed210.com/news#blog',
      url: 'https://www.shed210.com/news',
      publisher: {
        '@type': 'HomeAndConstructionBusiness',
        '@id': 'https://www.shed210.com/#localbusiness',
        name: 'Shed210',
      },
      blogPost: [
        {
          '@type': 'BlogPosting',
          headline: 'Cost Guide',
          url: 'https://www.shed210.com/news/cost',
          datePublished: '2026-07-20',
          dateModified: '2026-09-22',
        },
        {
          headline: 'Permit Guide',
          datePublished: '2026-05-15',
          dateModified: '2026-05-15',
        },
      ],
    })
  })

  it('builds website, breadcrumb, and article JSON-LD with absolute URLs', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.shed210.com'

    const websiteJsonLd = buildWebsiteJsonLd()
    expect(websiteJsonLd).toMatchObject({
      '@type': 'WebSite',
      name: 'Shed210',
      alternateName: ['Shed 210'],
      url: 'https://www.shed210.com/',
    })
    expect(websiteJsonLd).not.toHaveProperty('potentialAction')
    expect(buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Quote', path: '/quote' },
    ])).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, item: 'https://www.shed210.com/' },
        { position: 2, item: 'https://www.shed210.com/quote' },
      ],
    })
    expect(buildArticleJsonLd({
      title: 'Guide',
      description: 'Article description',
      path: '/news/guide',
      datePublished: '2026-05-15',
    })).toMatchObject({
      '@type': 'BlogPosting',
      mainEntityOfPage: 'https://www.shed210.com/news/guide',
      author: buildBusinessReferenceJsonLd(),
      publisher: buildBusinessReferenceJsonLd(),
    })
  })

  it('serializes JSON-LD without allowing HTML-significant input to close its script', () => {
    const malicious = '</script><script>alert("xss")</script>&>\u2028\u2029'
    const serialized = serializeJsonLd({ value: malicious })

    expect(serialized).not.toContain('</script>')
    expect(serialized).not.toContain('<script>')
    expect(serialized).toContain('\\u003c/script\\u003e')
    expect(serialized).toContain('\\u0026\\u003e\\u2028\\u2029')
    expect(JSON.parse(serialized)).toEqual({ value: malicious })
  })
})
