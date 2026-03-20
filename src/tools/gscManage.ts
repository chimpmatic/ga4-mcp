import { GoogleAuth } from 'google-auth-library';
import { getEditGscClient } from '../clients';

export async function gscAddSite(
    auth: GoogleAuth,
    siteUrl: string
): Promise<unknown> {
    const client = getEditGscClient(auth);
    await client.sites.add({ siteUrl });
    return { added: true, site_url: siteUrl };
}

export async function gscSubmitSitemap(
    auth: GoogleAuth,
    siteUrl: string,
    sitemapUrl: string
): Promise<unknown> {
    const client = getEditGscClient(auth);
    await client.sitemaps.submit({ siteUrl, feedpath: sitemapUrl });
    return { submitted: true, site_url: siteUrl, sitemap_url: sitemapUrl };
}
