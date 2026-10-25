import fs from 'node:fs';

export const SITE = {
  origin: 'https://getclient.co.za',
  name: 'Getclient',
  tagline: 'Attract. Convert. Grow.',
  company: 'Digitalx Group (Pty) Ltd',
  email: 'info@getclient.co.za',
  phones: [['+27218793035', '021 879 3035', 'Cape Town'], ['+27128800270', '012 880 0270', 'Pretoria'], ['+27782491129', '078 249 1129', 'Mobile']],
  whatsapp: 'https://wa.me/27218793035',
  address: 'Kuils River, Cape Town, South Africa',
  social: [
    ['https://x.com/digitalxio', 'fa-brands fa-x-twitter', 'X'],
    ['https://tiktok.com/@digitalxio', 'fa-brands fa-tiktok', 'TikTok'],
    ['https://facebook.com/digitalxio', 'fa-brands fa-facebook-f', 'Facebook'],
    ['https://instagram.com/digitalxagencyio', 'fa-brands fa-instagram', 'Instagram'],
    ['https://threads.net/@digitalxagencyio', 'fa-brands fa-threads', 'Threads'],
    ['https://wa.me/27218793035', 'fa-brands fa-whatsapp', 'WhatsApp']
  ],
  prices: { blue: 'R499', gold: 'R1,299' },
  period: 'per month',
  turnstileSiteKey: '0x4AAAAAAFavP5vcRoKQ-O30'
};

export const CATS = JSON.parse(fs.readFileSync(new URL('./cats.json', import.meta.url), 'utf8'));

export const PROVINCES = [
  { slug: 'western-cape', name: 'Western Cape', capital: 'Cape Town', line: 'Mountain, winelands and the Mother City' },
  { slug: 'gauteng', name: 'Gauteng', capital: 'Johannesburg', line: 'The economic heartbeat of the country' },
  { slug: 'kwazulu-natal', name: 'KwaZulu-Natal', capital: 'Pietermaritzburg', line: 'Warm water, busy ports, Durban energy' },
  { slug: 'eastern-cape', name: 'Eastern Cape', capital: 'Bhisho', line: 'From Nelson Mandela Bay to the Wild Coast' },
  { slug: 'free-state', name: 'Free State', capital: 'Bloemfontein', line: 'The city of roses and wide horizons' },
  { slug: 'limpopo', name: 'Limpopo', capital: 'Polokwane', line: 'Baobabs, farms and growing towns' },
  { slug: 'mpumalanga', name: 'Mpumalanga', capital: 'Mbombela', line: 'Gateway to the Lowveld' },
  { slug: 'northern-cape', name: 'Northern Cape', capital: 'Kimberley', line: 'Big sky country, the Diamond City' },
  { slug: 'north-west', name: 'North West', capital: 'Mahikeng', line: 'Platinum belt and Rustenburg trade' }
];

export const CITIES = [
  { slug: 'cape-town', name: 'Cape Town', province: 'western-cape' },
  { slug: 'johannesburg', name: 'Johannesburg', province: 'gauteng' },
  { slug: 'pretoria', name: 'Pretoria', province: 'gauteng' },
  { slug: 'durban', name: 'Durban', province: 'kwazulu-natal' },
  { slug: 'gqeberha', name: 'Gqeberha', province: 'eastern-cape' },
  { slug: 'bloemfontein', name: 'Bloemfontein', province: 'free-state' },
  { slug: 'east-london', name: 'East London', province: 'eastern-cape' },
  { slug: 'polokwane', name: 'Polokwane', province: 'limpopo' },
  { slug: 'mbombela', name: 'Mbombela', province: 'mpumalanga' },
  { slug: 'kimberley', name: 'Kimberley', province: 'northern-cape' },
  { slug: 'rustenburg', name: 'Rustenburg', province: 'north-west' },
  { slug: 'stellenbosch', name: 'Stellenbosch', province: 'western-cape' },
  { slug: 'kuils-river', name: 'Kuils River', province: 'western-cape' }
];

// Hello, in the languages of Mzansi
export const GREETINGS = [
  ['Sawubona', 'isiZulu'], ['Molo', 'isiXhosa'], ['Goeie dag', 'Afrikaans'], ['Dumela', 'Sesotho'],
  ['Dumelang', 'Setswana'], ['Thobela', 'Sepedi'], ['Avuxeni', 'Xitsonga'], ['Ndaa', 'Tshivenda'],
  ['Lotjhani', 'isiNdebele'], ['Sawubona', 'siSwati'], ['Hello', 'English']
];

export const CHECKS = [
  ['check_identity', 'Identity', 'identity'],
  ['check_cipc', 'CIPC registration', 'cipc'],
  ['check_insurance', 'Insurance', 'insurance'],
  ['check_trading_history', 'Trading history', 'trading_history'],
  ['check_reviews', 'Client ratings', 'reviews']
];

export const catBy = Object.fromEntries(CATS.map(c => [c.slug, c]));
export const cityBy = Object.fromEntries(CITIES.map(c => [c.slug, c]));
export const provBy = Object.fromEntries(PROVINCES.map(p => [p.slug, p]));

// What each tier gets. Drives the pricing comparison table and the plan cards.
// true / false, or a short string shown in the cell.
export const TIERS = [
  ['Price', 'Free', 'R499 per month', 'R1,299 per month'],
  ['Listed on Getclient badge on your website', 'Required', 'Required, shows Blue Verified', 'Required, shows Gold Verified'],
  ['Directory listing and profile page', true, true, true],
  ['Business description', true, true, true],
  ['Contact details (phone, email, website)', true, true, true],
  ['WhatsApp button', false, true, true],
  ['Quote requests from clients, emailed to you', false, true, true],
  ['Job offers from Get quotes matching (you accept or decline)', false, 'Yes', 'Yes, offered first'],
  ['Business dashboard: stats, edit listing, answer jobs', true, true, true],
  ['Photos', false, 'Up to 6', 'Up to 20, plus a cover image'],
  ['List your services', false, 'Up to 8 services', 'Up to 12 services'],
  ['Identity and CIPC check', false, true, true],
  ['Insurance, tax clearance and 3+ years trading checked', false, false, true],
  ['Verified seal next to your name', false, 'Blue seal', 'Gold seal'],
  ['Search ranking', 'After verified listings', 'Above all Basic listings', 'Top of every list'],
  ['Promotion', false, 'Blue Verified showcase on every page, under Gold', 'Ads on every page and section of the site'],
  ['Featured on the homepage, your category and your city', false, 'In the Blue Verified row', 'In the sponsored Gold slots'],
  ['Highlighted listing card', false, 'Blue verified ribbon', 'Gold border and Ad tag'],
  ['Re-verification every 12 months', false, true, true],
  ['Support', 'Email', 'Priority support', 'Dedicated account manager']
];
