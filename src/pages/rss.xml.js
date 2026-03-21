import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const essays = await getCollection('essays');
  return rss({
    title: 'Apurva Desai',
    description: 'Cloud engineering, ML, and the occasional rabbit hole.',
    site: context.site,
    items: essays
      .filter(e => !e.data.draft)
      .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())
      .map(essay => ({
        title: essay.data.title,
        description: essay.data.description,
        pubDate: essay.data.publishDate,
        link: `/essays/${essay.slug}/`,
      })),
  });
}
