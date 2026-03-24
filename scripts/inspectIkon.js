/* eslint-disable no-console */

const RSS = 'https://ikon.mn/rss';
const TARGET_IMAGE_FILENAME = process.argv[2] || 'tihkmt_800_x_400_ph.jpg';

function extractFirst(xml, regex) {
  const match = xml.match(regex);
  return match ? match[1] : null;
}

function stripCdata(text) {
  return String(text || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

async function main() {
  const rssRes = await fetch(RSS, { headers: { 'User-Agent': 'NEWSAP/1.0' } });
  const xml = await rssRes.text();

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  const found = items.find((it) => it.includes(TARGET_IMAGE_FILENAME));

  if (!found) {
    console.log('Not found in RSS:', TARGET_IMAGE_FILENAME);
    console.log('RSS item count:', items.length);
    process.exitCode = 1;
    return;
  }

  const titleRaw = extractFirst(found, /<title>([\s\S]*?)<\/title>/i);
  const linkRaw = extractFirst(found, /<link>([\s\S]*?)<\/link>/i);
  const media =
    extractFirst(found, /<media:content[^>]+url=\"([^\"]+)\"/i) ||
    extractFirst(found, /<media:thumbnail[^>]+url=\"([^\"]+)\"/i);
  const enclosure = extractFirst(found, /<enclosure[^>]+url=\"([^\"]+)\"/i);

  const title = stripCdata(titleRaw);
  const articleUrl = String(linkRaw || '').replace(/<[^>]*>/g, '').trim();

  console.log('Title:', title.slice(0, 160));
  console.log('Article URL:', articleUrl);
  console.log('media:', media);
  console.log('enclosure:', enclosure);

  if (!articleUrl) {
    console.log('No article URL extracted.');
    process.exitCode = 1;
    return;
  }

  const pageRes = await fetch(articleUrl, {
    headers: {
      Accept: 'text/html,*/*',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    },
  });

  console.log('Page status:', pageRes.status);
  const html = await pageRes.text();

  const og =
    html.match(/<meta[^>]+property=\"og:image\"[^>]+content=\"([^\"]+)\"/i)?.[1] ||
    html.match(/<meta[^>]+content=\"([^\"]+)\"[^>]+property=\"og:image\"/i)?.[1];

  const ogW = html.match(/<meta[^>]+property=\"og:image:width\"[^>]+content=\"([^\"]+)\"/i)?.[1];
  const ogH = html.match(/<meta[^>]+property=\"og:image:height\"[^>]+content=\"([^\"]+)\"/i)?.[1];

  console.log('og:image:', og);
  console.log('og:image:width,height:', ogW, ogH);

  const srcsets = [...html.matchAll(/\ssrcset=\"([^\"]+)\"/gi)].map((m) => m[1]);
  console.log('srcset attr count:', srcsets.length);
  if (srcsets[0]) console.log('srcset[0] (prefix):', srcsets[0].slice(0, 240));
}

main().catch((error) => {
  console.error('Error:', error);
  process.exitCode = 1;
});
