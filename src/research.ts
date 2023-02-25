import joplin from 'api';
import { query_completion } from './openai';
import { JarvisSettings } from './settings';

interface PaperInfo {
  title: string;
  author: string[];
  year: number;
  journal: string;
  doi: string;
  citation_count: number;
  abstract: string;
  summary: string;
  compression: number;
}

export async function do_research(prompt: string, n_papers: number,
    paper_tokens: number, only_search: boolean, settings: JarvisSettings): Promise<string> {

  const papers = await search_papers(prompt, n_papers, settings).then(
    (ids) => sample_and_summarize_papers(ids, paper_tokens, prompt, settings));

  const full_prompt = get_full_prompt(papers, prompt);
  if (only_search) {
    return '';
  }
  const research = await query_completion(full_prompt, settings);

  return research;
}

async function search_papers(prompt: string, n: number, settings: JarvisSettings): Promise<PaperInfo[]> {
  const headers = {
    'Accept': 'application/json',
    'X-ELS-APIKey': settings.scopus_api_key,
  };
  const options = {
    method: 'GET',
    headers: headers,
  };

  let query = await get_paper_search_query(prompt, settings);
  const retries = 2;
  let start = 0;
  let results: PaperInfo[] = [];

  // calculates the number of pages needed to fetch n results
  let pages = Math.ceil(n / 25);

  for (let i = 0; i < pages; i++) {
    const url = `https://api.elsevier.com/content/search/scopus?query=${query}&count=25&start=${start}&sort=-relevancy,-citedby-count,-pubyear`;
    let response = await fetch(url, options);

    if (!response.ok) {
      if (pages > retries) {
        return null;
      }
      console.log('retrying search query');
      query = await get_paper_search_query(prompt, settings);
      pages += 1;
      continue
    }

    try {
      const jsonResponse = await response.json();
      const papers = jsonResponse['search-results']['entry'];
      for (let i = 0; i < papers.length; i++) {
        try {
          const info: PaperInfo = {
            title: papers[i]['dc:title'],
            author: papers[i]['dc:creator'].split(', ')[0].split(' ')[0],
            year: parseInt(papers[i]['prism:coverDate'].split('-')[0], 10),
            journal: papers[i]['prism:publicationName'],
            doi: papers[i]['prism:doi'],
            citation_count: parseInt(papers[i]['citedby-count'], 10),
            abstract: papers[i]['dc:description'],
            summary: '',
            compression: 1,
          }
          results.push(info);
        } catch {
          console.log('skipped', papers[i]);
          continue;
        }
      }
      start += 25;
    } catch (error) {
      console.log(error);
    }
  }

  return results.slice(0, n);
}

async function get_paper_search_query(prompt: string, settings: JarvisSettings): Promise<string> {
  const query = await query_completion(
    `write a bibliographic search query for scientific papers that will be helpful
    to generate a response to the following prompt:\n${prompt}`, settings);
  await joplin.commands.execute('replaceSelection', '\nsearching for: ' + query + '\n\n');
  return query;
}

async function sample_and_summarize_papers(papers: PaperInfo[], max_tokens: number,
    query: string, settings: JarvisSettings): Promise<PaperInfo[]> {
  let results: PaperInfo[] = [];
  let tokens = 0;

  // randomize the order of the papers
  papers.sort(() => Math.random() - 0.5);
  const promises: Promise<PaperInfo>[] = [];
  for (let i = 0; i < papers.length; i++) {

    if ( promises.length <= i ) {
      // try to get a summary for the next 5 papers asynchonously
      for (let j = 0; j < 5; j++) {
        if (i + j < papers.length) {
          promises.push(get_paper_summary(papers[i + j], query, settings));
        }
      }
    }
    // wait for the next summary to be ready
    papers[i] = await promises[i];
    if ( !papers[i]['summary'] ) { continue; }

    // we only summarize papers up to a total length of max_tokens
    if (tokens + papers[i]['summary'].length / 4 > max_tokens) { 
      break;
    }
    results.push(papers[i]);
    tokens += papers[i]['summary'].length / 4;
  }

  console.log(`sampled ${results.length} papers. retrieved ${promises.length} papers.`);
  return results;
}

function get_full_prompt(papers: PaperInfo[], prompt: string): string {
  let full_prompt = 
    `write a response to the prompt. use all relevant papers out of the following ones,
    and cite what you use in the response. you may add additional uncited information
    that might be considered common knowledge. try to explain the definitions of domain-specific terms.\n\n`;
  for (let i = 0; i < papers.length; i++) {
    full_prompt += papers[i]['summary'] + '\n\n';
  }
  full_prompt += `prompt: ${prompt}`;
  return full_prompt;
}

async function get_paper_summary(paper: PaperInfo,
    prompt: string, settings: JarvisSettings): Promise<PaperInfo> {
  paper = await get_paper_abstract(paper, settings);
  if ( !paper['abstract'] ) { return paper; }

  const response = await query_completion(
    `summarize concisely in one paragraph containing short sentences
    the following paper, focusing on information relevant to the prompt.
    prompt:\n${prompt}
    abstract:\n${paper['abstract']}`, settings);

  paper['summary'] = `(${paper['author']}, ${paper['year']}) ${response.trim()}`;
  paper['compression'] = paper['summary'].length / paper['abstract'].length;

  let cite = `- ${paper['author']} et al., [${paper['title']}](https://doi.org/${paper['doi']}), ${paper['journal']}, ${paper['year']}, cited: ${paper['citation_count']}.\n`;
  if (settings.include_paper_summary) {
    cite += `\t- ${paper['summary'].replace('\n', '')}\n`;
  }
  await joplin.commands.execute('replaceSelection', cite);
  return paper;
}

async function get_paper_abstract(paper: PaperInfo, settings: JarvisSettings): Promise<PaperInfo> {
  let info = await get_crossref_info(paper);  // Crossref
  if (info['abstract']) { return info; }
  else {
    info = await get_scopus_info(paper, settings);  // Scopus
    if (info['asbtract']) { return info; }
    else {
      return await get_scidir_info(paper, settings);  // ScienceDirect (Elsevier)
    }
  }
}

async function get_crossref_info(paper: PaperInfo): Promise<PaperInfo> {
  const url = `https://api.crossref.org/works/${paper['doi']}`;
  const headers = {
    "Accept": "application/json",
  };
  const options = {
    method: 'GET',
    headers: headers,
  };

  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) { return paper; }

  if (!response.ok) { return paper; }

  try {
    const jsonResponse = await response.json();
    const info = jsonResponse['message'];
    if ( info['abstract'] ) {
      paper['abstract'] = info['abstract'].trim();
    }
  }
  catch (error) {
    // console.log(error);
  }
  return paper;
}

async function get_scidir_info(paper: PaperInfo, settings: JarvisSettings): Promise<PaperInfo> {
  const url = `https://api.elsevier.com/content/article/doi/${paper['doi']}`;
  const headers = {
    'Accept': 'application/json',
    'X-ELS-APIKey': settings.scopus_api_key,
  };
  const options = {
    method: 'GET',
    headers: headers,
  };
  let response = await fetch(url, options);

  if (!response.ok) { return paper; }

  try {
    const jsonResponse = await response.json();
    const info = jsonResponse['full-text-retrieval-response']['coredata'];
    if ( info['dc:description'] ) {
      paper['abstract'] = info['dc:description'].trim();
    }
  }
  catch (error) {
    // console.log(error);
  }
  return paper;
}

async function get_scopus_info(paper: PaperInfo, settings: JarvisSettings): Promise<PaperInfo> {
  const url = `https://api.elsevier.com/content/abstract/doi/${paper['doi']}`;
  const headers = {
    'Accept': 'application/json',
    'X-ELS-APIKey': settings.scopus_api_key,
  };
  const options = {
    method: 'GET',
    headers: headers,
  };
  let response = await fetch(url, options);

  if (!response.ok) { return paper; }

  try {
    const jsonResponse = await response.json()
    const info = jsonResponse['abstracts-retrieval-response']['coredata'];
    if ( info['dc:description'] ) {
      paper['abstract'] = info['dc:description'].trim();
    }
  }
  catch (error) {
    // console.log(error);
  }
  return paper;
}