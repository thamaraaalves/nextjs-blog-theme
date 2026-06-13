import * as cheerio from 'cheerio';

const SECTOR_MAP = {
  Technology: 'Tecnologia',
  'Financial Services': 'Financeiro',
  Healthcare: 'Saúde',
  Energy: 'Energia',
  'Consumer Cyclical': 'Varejo',
  Industrials: 'Industrial',
  'Basic Materials': 'Agronegócio',
  'Real Estate': 'Imobiliário',
  Utilities: 'Infraestrutura',
  'Communication Services': 'Telecomunicações',
  'Consumer Defensive': 'Consumo',
};

const SAMPLE_IPOS = [
  {
    id: 'nubank-2025',
    company: 'NuBank Expansão S.A.',
    symbol: 'NUBK3',
    date: '2026-07-10',
    exchange: 'B3',
    sector: 'Financeiro',
    priceRange: 'R$ 18,00 – R$ 22,00',
    volume: 'R$ 1,2 Bi',
    status: 'upcoming',
    description: 'Expansão da fintech líder em cartões de crédito e contas digitais no Brasil.',
  },
  {
    id: 'agrogalaxy-2025',
    company: 'AgroGalaxy Participações',
    symbol: 'AGXY3',
    date: '2026-07-18',
    exchange: 'B3',
    sector: 'Agronegócio',
    priceRange: 'R$ 9,50 – R$ 12,00',
    volume: 'R$ 450 Mi',
    status: 'upcoming',
    description: 'Distribuidora de insumos agrícolas com presença em 13 estados.',
  },
  {
    id: 'vortx-2025',
    company: 'Vórtx Infraestrutura',
    symbol: 'VRTX3',
    date: '2026-07-25',
    exchange: 'B3',
    sector: 'Infraestrutura',
    priceRange: 'R$ 14,00 – R$ 17,50',
    volume: 'R$ 800 Mi',
    status: 'upcoming',
    description: 'Empresa de infraestrutura digital e data centers no Brasil.',
  },
  {
    id: 'clinicorp-2025',
    company: 'Clínicorp Saúde S.A.',
    symbol: 'CLNC3',
    date: '2026-08-05',
    exchange: 'B3',
    sector: 'Saúde',
    priceRange: 'R$ 11,00 – R$ 14,00',
    volume: 'R$ 600 Mi',
    status: 'upcoming',
    description: 'Rede de clínicas de saúde preventiva e diagnósticos integrados.',
  },
  {
    id: 'sirius-tech-2025',
    company: 'Sirius Tecnologia',
    symbol: 'SRTC3',
    date: '2026-08-12',
    exchange: 'B3',
    sector: 'Tecnologia',
    priceRange: 'R$ 20,00 – R$ 25,00',
    volume: 'R$ 1,5 Bi',
    status: 'upcoming',
    description: 'Plataforma SaaS B2B para gestão empresarial de médias empresas.',
  },
  {
    id: 'energisa-solar',
    company: 'Energisa Solar',
    symbol: 'ENSL3',
    date: '2026-08-20',
    exchange: 'B3',
    sector: 'Energia',
    priceRange: 'R$ 16,00 – R$ 19,00',
    volume: 'R$ 900 Mi',
    status: 'upcoming',
    description: 'Subsidiária de energia solar distribuída da Energisa, líder em geração.',
  },
  {
    id: 'vivara-expansao',
    company: 'Vivara Expansão FIAGRO',
    symbol: 'VIVR11',
    date: '2026-09-03',
    exchange: 'B3',
    sector: 'Imobiliário',
    priceRange: 'R$ 10,00',
    volume: 'R$ 300 Mi',
    status: 'upcoming',
    description: 'FIAGRO focado em imóveis rurais e infraestrutura agroindustrial.',
  },
  {
    id: 'brasilprev-ipo',
    company: 'BrasilPrev Seguros',
    symbol: 'BPVS3',
    date: '2026-09-15',
    exchange: 'B3',
    sector: 'Financeiro',
    priceRange: 'R$ 22,00 – R$ 28,00',
    volume: 'R$ 2,0 Bi',
    status: 'upcoming',
    description: 'Maior gestora de previdência privada do Brasil, controlada pelo Bradesco.',
  },
  {
    id: 'raizens-logistica',
    company: 'Raízen Logística',
    symbol: 'RNLG3',
    date: '2026-09-22',
    exchange: 'B3',
    sector: 'Industrial',
    priceRange: 'R$ 8,00 – R$ 11,00',
    volume: 'R$ 700 Mi',
    status: 'upcoming',
    description: 'Braço de logística da Raízen para distribuição de combustíveis e biocombustíveis.',
  },
  {
    id: 'mobly-retail',
    company: 'Mobly Marketplace',
    symbol: 'MBLY3',
    date: '2026-10-08',
    exchange: 'B3',
    sector: 'Varejo',
    priceRange: 'R$ 6,00 – R$ 9,00',
    volume: 'R$ 250 Mi',
    status: 'upcoming',
    description: 'Marketplace de móveis e decoração com modelo híbrido online/offline.',
  },
];

async function scrapeInvestingCom() {
  const url = 'https://br.investing.com/ipo-calendar/';
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const ipos = [];

  $('table.genTbl tbody tr, #ipoCalendarData tbody tr').each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) return;

    const dateText = $(cells[0]).text().trim();
    const companyEl = $(cells[1]).find('a');
    const company = companyEl.length ? companyEl.text().trim() : $(cells[1]).text().trim();
    const symbol = $(cells[2]).text().trim();
    const exchange = $(cells[3]).text().trim();
    const sectorRaw = $(cells[4])?.text().trim() || '';
    const priceRange = $(cells[5])?.text().trim() || '–';
    const volume = $(cells[6])?.text().trim() || '–';

    if (!company) return;

    const sector = SECTOR_MAP[sectorRaw] || sectorRaw || 'Outros';

    ipos.push({
      id: `inv-${i}-${Date.now()}`,
      company,
      symbol: symbol || '–',
      date: dateText,
      exchange: exchange || 'B3',
      sector,
      priceRange,
      volume,
      status: 'upcoming',
      description: '',
    });
  });

  if (ipos.length === 0) throw new Error('No IPO rows found');
  return ipos;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const ipos = await scrapeInvestingCom();
    return res.status(200).json({ ipos, source: 'live', updatedAt: new Date().toISOString() });
  } catch (err) {
    return res.status(200).json({
      ipos: SAMPLE_IPOS,
      source: 'sample',
      sourceNote: 'Dados demonstrativos — site externo indisponível',
      updatedAt: new Date().toISOString(),
    });
  }
}
