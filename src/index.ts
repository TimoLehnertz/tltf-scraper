import axios from 'axios';
import fs from 'fs';
import nodemailer from 'nodemailer';
import path from 'path';

interface ProductScaper {
  url: string;
  callback(source: string): boolean;
}

type ProductStatus = 'available' | 'not available' | 'error';

interface ExtendedProductScaper extends ProductScaper {
  state?: ProductStatus;
}

type ChangeListener = (scraper: ProductScaper, status: ProductStatus) => void;
type ScapeListener = (scraper: ProductScaper, status: ProductStatus) => void;

class ProductsScraper {

  private changeListeners: ChangeListener[] = [];
  private scrapeListeners: ScapeListener[] = [];

  private readonly scrapers: ExtendedProductScaper[];

  constructor(scrapers: ProductScaper[]) {
    this.scrapers = scrapers;
  }

  addChangeListener(changeListener: ChangeListener): void {
    this.changeListeners.push(changeListener);
  }

  addScraperListener(listener: ScapeListener): void {
    this.scrapeListeners.push(listener);
  }

  async scrapeAll() {
    for (const scraper of this.scrapers) {
      await this.scrapeOne(scraper);
    }
  }

  private async scrapeOne(scraper: ExtendedProductScaper) {
    let newState: ProductStatus;
    try {
      const response = await axios.get(scraper.url);
      const available = scraper.callback(response.data);
      newState = available ? 'available' : 'not available';
    } catch (error) {
      newState = 'error';
      console.error('Fetch error:', error);
    }
    if (scraper.state !== undefined && scraper.state !== newState) {
      this.changeListeners.forEach(l => l(scraper, newState));
    }
    scraper.state = newState;
    this.scrapeListeners.forEach(l => l(scraper, newState));
  }
}


function appendToFile(filename: string, content: string): void {
  const filePath = path.resolve(filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '');
  }
  fs.appendFileSync(filePath, content);
}


async function sendEmail(to: string, subject: string, text: string) {
  // Configure the transporter for Gmail
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'timolehnertz1@gmail.com',
      pass: 'kmrd iqyp difv hfve', // App password from Gmail
    },
  });

  // Define the email options
  const mailOptions = {
    from: 'timolehnertz1@gmail.com',
    to,
    subject,
    text,
  };

  try {
    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

const urls = [
  'https://tltfwheels.com/collections/indoor-wheels/products/copy-of-strain-xps-110mm-3-75-arc-includes-shipping-to-odn',
  'https://tltfwheels.com/collections/indoor-wheels/products/copy-of-2023-strain-xps-3-75-110mm-red-core-11-spoke-limit-2-sets-per-customer',
  'https://tltfwheels.com/collections/indoor-wheels/products/2024-strain-xps-3-75-110mm-red-t-72-core-11-spoke-copy',
  'https://tltfwheels.com/collections/indoor-wheels/products/copy-of-2024-strain-xps-3-50-medium-110mm-clear-t-72-core-11-spoke',
  'https://tltfwheels.com/collections/indoor-wheels/products/copy-of-2024-strain-xps-3-75-110mm-blue-t-72-core-11-spoke',
  'https://tltfwheels.com/collections/indoor-wheels/products/copy-of-2024-strain-xps-3-75-hard-110mm-clear-t-72-core-11-spoke',
];

const scrapers: ProductScaper[] = [];
for (const url of urls) {
  scrapers.push({
    url,
    callback: (html: string) => !html.includes('id="AddToCart-product-template" disabled="disabled"'),
  })
}

const scraper = new ProductsScraper(scrapers);

scraper.addChangeListener((scraper: ProductScaper, status: ProductStatus) => {
  switch (status) {
    case 'available':
      sendEmail('timolehnertz1@gmail.com', 'TLTF wheels are available!!', 'TLTF wheels are available! ' + scraper.url);
      break;
    case 'error':
      sendEmail('timolehnertz1@gmail.com', 'TLTF scraper is broken', 'The scraper is broken');
      break;
    case 'not available':
      sendEmail('timolehnertz1@gmail.com', 'No more TLTF wheels are no more available', 'TLTF wheels are not available anymore or the scraper is no longer broken. At ' + scraper.url);
      break;
  }
});

scraper.addScraperListener((scraper, state) => {
  appendToFile('log.json', JSON.stringify({ state, date: new Date(), url: scraper.url }) + '\n');
  console.log(new Date(), 'State: ', state, 'scraped ', scraper.url);
});

async function checker() {
  await scraper.scrapeAll();
  setTimeout(checker, 1000 + Math.random() * 600000);
}

checker();