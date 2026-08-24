import { SourceCategory } from '../types';

export interface DomainProfile {
  domain: string;
  name: string;
  category: SourceCategory;
  baseCredibility: number;
  sourceType: string;
  isPrimarySource: boolean;
}

export const CREDIBLE_DOMAINS: DomainProfile[] = [
  // Tech / Software
  { domain: 'developer.mozilla.org', name: 'MDN Web Docs', category: 'Tech', baseCredibility: 98, sourceType: 'Official Web Documentation', isPrimarySource: true },
  { domain: 'github.com', name: 'GitHub Open Source', category: 'Tech', baseCredibility: 95, sourceType: 'Source Code & Releases Repository', isPrimarySource: true },
  { domain: 'stackoverflow.com', name: 'Stack Overflow', category: 'Tech', baseCredibility: 88, sourceType: 'Developer Q&A Community', isPrimarySource: false },
  { domain: 'archive.org', name: 'Internet Archive & Stack Exchange Dumps', category: 'Tech', baseCredibility: 96, sourceType: 'Digital Library & Open Q&A Archives', isPrimarySource: true },
  { domain: 'commoncrawl.org', name: 'Common Crawl Repository', category: 'Tech', baseCredibility: 95, sourceType: 'Petabyte-Scale Web Archive', isPrimarySource: true },
  { domain: 'docs.microsoft.com', name: 'Microsoft Learn', category: 'Tech', baseCredibility: 96, sourceType: 'Vendor Documentation', isPrimarySource: true },
  { domain: 'learn.microsoft.com', name: 'Microsoft Learn', category: 'Tech', baseCredibility: 96, sourceType: 'Vendor Documentation', isPrimarySource: true },
  { domain: 'arstechnica.com', name: 'Ars Technica', category: 'Tech', baseCredibility: 90, sourceType: 'Tech Journalism Outlet', isPrimarySource: false },
  { domain: 'theverge.com', name: 'The Verge', category: 'Tech', baseCredibility: 87, sourceType: 'Technology News', isPrimarySource: false },
  { domain: 'react.dev', name: 'React Official Documentation', category: 'Tech', baseCredibility: 99, sourceType: 'Framework Core Docs', isPrimarySource: true },
  { domain: 'python.org', name: 'Python Software Foundation', category: 'Tech', baseCredibility: 98, sourceType: 'Official Language Reference', isPrimarySource: true },
  { domain: 'developer.apple.com', name: 'Apple Developer Documentation', category: 'Tech', baseCredibility: 98, sourceType: 'Official Platform SDK Docs', isPrimarySource: true },
  { domain: 'developer.android.com', name: 'Android Developers', category: 'Tech', baseCredibility: 98, sourceType: 'Official Platform Docs', isPrimarySource: true },
  { domain: 'npmjs.com', name: 'NPM Registry', category: 'Tech', baseCredibility: 92, sourceType: 'Package Repository', isPrimarySource: true },
  { domain: 'pypi.org', name: 'PyPI Python Packages', category: 'Tech', baseCredibility: 92, sourceType: 'Package Repository', isPrimarySource: true },

  // Academic & Philosophical Encyclopedias
  { domain: 'plato.stanford.edu', name: 'Stanford Encyclopedia of Philosophy', category: 'Science', baseCredibility: 99, sourceType: 'Peer-Reviewed Stanford Philosophy Encyclopedia', isPrimarySource: true },
  { domain: 'stanford.edu', name: 'Stanford Academic Repository', category: 'Science', baseCredibility: 98, sourceType: 'University Research Domain', isPrimarySource: true },
  { domain: 'iep.utm.edu', name: 'Internet Encyclopedia of Philosophy', category: 'Science', baseCredibility: 97, sourceType: 'Peer-Reviewed Philosophy Encyclopedia', isPrimarySource: true },
  { domain: 'utm.edu', name: 'University of Tennessee at Martin', category: 'Science', baseCredibility: 95, sourceType: 'Academic Research Domain', isPrimarySource: true },
  { domain: 'thecanadianencyclopedia.ca', name: 'The Canadian Encyclopedia', category: 'Science', baseCredibility: 96, sourceType: 'Official Canadian Historical Encyclopedia', isPrimarySource: true },
  { domain: 'oregonencyclopedia.org', name: 'Oregon Encyclopedia', category: 'Science', baseCredibility: 95, sourceType: 'Oregon Historical Society Encyclopedia', isPrimarySource: true },
  { domain: 'tshaonline.org', name: 'Texas Day by Day TSHA', category: 'Science', baseCredibility: 95, sourceType: 'Texas State Historical Association DB', isPrimarySource: true },
  { domain: 'encyclopediaofarkansas.net', name: 'Encyclopedia of Arkansas', category: 'Science', baseCredibility: 95, sourceType: 'US Regional History & Culture Archive', isPrimarySource: true },
  { domain: 'cyclopaedia.org', name: 'Cyclopaedia 18th Century Archive', category: 'Science', baseCredibility: 94, sourceType: 'Digitized 18th Century Universal Dictionary', isPrimarySource: true },
  { domain: 'encyclopediaofearth.org', name: 'Encyclopedia of Earth', category: 'Science', baseCredibility: 96, sourceType: 'Environmental & Geological Science Encyclopedia', isPrimarySource: true },
  { domain: 'encyclopedia.ushmm.org', name: 'US Holocaust Memorial Museum Encyclopedia', category: 'Science', baseCredibility: 99, sourceType: 'Official Holocaust Historical Archive', isPrimarySource: true },
  { domain: 'ushmm.org', name: 'US Holocaust Memorial Museum', category: 'Science', baseCredibility: 99, sourceType: 'Official Museum Historical Archives', isPrimarySource: true },
  { domain: 'case.edu', name: 'Encyclopedia of Cleveland History Case Western', category: 'Science', baseCredibility: 96, sourceType: 'Academic Regional History Encyclopedia', isPrimarySource: true },
  { domain: 'encyclopedia.com', name: 'Encyclopedia.com Aggregated Archives', category: 'Science', baseCredibility: 92, sourceType: 'Reference Knowledge Base', isPrimarySource: false },
  { domain: 'rationalwiki.org', name: 'RationalWiki Skeptical Knowledge Base', category: 'Science', baseCredibility: 88, sourceType: 'Skeptical Community Wiki', isPrimarySource: false },
  { domain: 'eos.kokugakuin.ac.jp', name: 'Encyclopedia of Shinto', category: 'Science', baseCredibility: 97, sourceType: 'Kokugakuin University Shinto History DB', isPrimarySource: true },
  { domain: 'runeberg.org', name: 'Project Runeberg Nordisk Familjebok', category: 'Science', baseCredibility: 96, sourceType: 'Scandinavian Historical Encyclopedia OCR', isPrimarySource: true },

  // Historical Sources, Archival Libraries & Primary Texts
  { domain: 'gutenberg.org', name: 'Project Gutenberg Main Archive', category: 'Science', baseCredibility: 98, sourceType: 'Public Domain Ebook Repository (70k+ Books)', isPrimarySource: true },
  { domain: 'gutenberg.net.au', name: 'Project Gutenberg Australia', category: 'Science', baseCredibility: 97, sourceType: 'Public Domain Historical Literature Australia', isPrimarySource: true },
  { domain: 'gutenberg.ca', name: 'Project Gutenberg Canada', category: 'Science', baseCredibility: 97, sourceType: 'Public Domain Canadian Historical Literature', isPrimarySource: true },
  { domain: 'onlinebooks.library.upenn.edu', name: 'UPenn Online Books Page', category: 'Science', baseCredibility: 98, sourceType: 'UPenn 5M Free Text Index', isPrimarySource: true },
  { domain: 'historicjournals.org', name: 'Historic Periodical & Newspaper Archive', category: 'Science', baseCredibility: 96, sourceType: 'Digitized Historical Journals Repository', isPrimarySource: true },
  { domain: 'zeno.org', name: 'Zeno.org Full Text Classical Library', category: 'Science', baseCredibility: 96, sourceType: 'German Historical Literature & Philosophy', isPrimarySource: true },
  { domain: 'virginia.edu', name: 'University of Virginia Electronic Text Center', category: 'Science', baseCredibility: 98, sourceType: 'UVA Historical Text Repository', isPrimarySource: true },
  { domain: 'state.gov', name: 'US Department of State Historical Foreign Relations', category: 'Legal', baseCredibility: 99, sourceType: 'Official US Diplomatic History Archive', isPrimarySource: true },
  { domain: 'manuscriptorium.com', name: 'Manuscriptorium Manuscripts Portal', category: 'Science', baseCredibility: 98, sourceType: 'European Historical Manuscripts OAI-PMH', isPrimarySource: true },
  { domain: 'nationalarchives.ie', name: 'National Archives of Ireland', category: 'Legal', baseCredibility: 99, sourceType: 'Official Irish Census & Legislative Records', isPrimarySource: true },
  { domain: 'worldhistory.org', name: 'World History Encyclopedia', category: 'Science', baseCredibility: 96, sourceType: 'Nonprofit Educational History Publication', isPrimarySource: true },
  { domain: 'fordham.edu', name: 'Fordham Internet History Sourcebooks', category: 'Science', baseCredibility: 98, sourceType: 'Fordham Ancient & Medieval Sourcebook', isPrimarySource: true },
  { domain: 'founders.archives.gov', name: 'Founding Fathers Papers US', category: 'Legal', baseCredibility: 100, sourceType: 'US Official Transcribed Historical Letters', isPrimarySource: true },
  { domain: 'avalon.law.yale.edu', name: 'Yale Law Avalon Project', category: 'Legal', baseCredibility: 100, sourceType: 'Yale Historical Treaties & Documents', isPrimarySource: true },
  { domain: 'british-history.ac.uk', name: 'British History Online BHO', category: 'Science', baseCredibility: 98, sourceType: 'Institute of Historical Research Academic DB', isPrimarySource: true },

  // Global Government & Urban Open Data
  { domain: 'data.govt.nz', name: 'Open Data New Zealand', category: 'Legal', baseCredibility: 99, sourceType: 'Official NZ Public Data & Maori Heritage', isPrimarySource: true },
  { domain: 'data.gov.sg', name: 'Singapore Open Data Portal', category: 'Legal', baseCredibility: 99, sourceType: 'Official Singapore Government Real-Time API', isPrimarySource: true },
  { domain: 'data.go.kr', name: 'Korea Official Open Data Portal', category: 'Legal', baseCredibility: 98, sourceType: 'Official South Korea Public Data', isPrimarySource: true },
  { domain: 'data.gov.in', name: 'India National Open Data Portal', category: 'Legal', baseCredibility: 98, sourceType: 'Official Government of India Open Data', isPrimarySource: true },
  { domain: 'govdata.de', name: 'GovData Open Data Germany', category: 'Legal', baseCredibility: 99, sourceType: 'Official Federal German Public Data', isPrimarySource: true },
  { domain: 'open.canada.ca', name: 'Open Canada Data Portal', category: 'Legal', baseCredibility: 99, sourceType: 'Official Canadian Government Open Data', isPrimarySource: true },
  { domain: 'opendata.paris.fr', name: 'Open Data Paris', category: 'Legal', baseCredibility: 98, sourceType: 'Paris Architectural & Historical GIS Data', isPrimarySource: true },
  { domain: 'data.cityofnewyork.us', name: 'NYC Open Data', category: 'Legal', baseCredibility: 98, sourceType: 'New York City Historical Records & Demographics', isPrimarySource: true },
  { domain: 'data.london.gov.uk', name: 'London Datastore', category: 'Legal', baseCredibility: 98, sourceType: 'Greater London Authority Public Data', isPrimarySource: true },
  { domain: 'data.metro.tokyo.lg.jp', name: 'Tokyo Open Data', category: 'Legal', baseCredibility: 98, sourceType: 'Tokyo Metropolitan Government Statistics', isPrimarySource: true },
  { domain: 'treaties.un.org', name: 'United Nations Treaty Collection', category: 'Legal', baseCredibility: 100, sourceType: 'Official UN Treaties & Legal Instruments', isPrimarySource: true },
  { domain: 'ec.europa.eu', name: 'Eurostat European Statistics', category: 'Legal', baseCredibility: 99, sourceType: 'Official European Commission Historical Data', isPrimarySource: true },
  { domain: 'census.gov', name: 'US Census Bureau API', category: 'Legal', baseCredibility: 99, sourceType: 'US Census 1790-Present Demographic API', isPrimarySource: true },
  { domain: 'davidrumsey.com', name: 'David Rumsey Map Collection', category: 'Travel', baseCredibility: 98, sourceType: 'Historical Cartographic GIS Metadata', isPrimarySource: true },

  // AI & Open Knowledge Graph Repositories
  { domain: 'allenai.org', name: 'Allen Institute for AI Dolma Dataset', category: 'Tech', baseCredibility: 98, sourceType: '3 Trillion Token Clean AI Corpus', isPrimarySource: true },
  { domain: 'eleuther.ai', name: 'EleutherAI The Pile Dataset', category: 'Tech', baseCredibility: 97, sourceType: '825GB Open Knowledge Benchmark Set', isPrimarySource: true },
  { domain: 'together.ai', name: 'Together AI RedPajama Corpus', category: 'Tech', baseCredibility: 97, sourceType: '1.2T Token Open Source Model Training Set', isPrimarySource: true },
  { domain: 'laion.ai', name: 'LAION Open Dataset Repository', category: 'Tech', baseCredibility: 96, sourceType: 'Massive Open Text & Visual Metadata Corpus', isPrimarySource: true },
  { domain: 'query.wikidata.org', name: 'Wikidata Query Service WDQS', category: 'Science', baseCredibility: 98, sourceType: 'Live SPARQL Graph Endpoint', isPrimarySource: true },
  { domain: 'conceptnet.io', name: 'ConceptNet Semantic Knowledge Graph', category: 'Tech', baseCredibility: 97, sourceType: 'Open Multilingual Commonsense Knowledge Graph', isPrimarySource: true },
  { domain: 'yago-knowledge.org', name: 'YAGO Knowledge Base', category: 'Science', baseCredibility: 98, sourceType: '120M Event & Entity Temporal Ontology', isPrimarySource: true },
  { domain: 'babelnet.org', name: 'BabelNet Multilingual Dictionary', category: 'Science', baseCredibility: 97, sourceType: 'Encyclopedic Dictionary & Semantic Network', isPrimarySource: true },

  // Open Medical, Science & Patent Registries
  { domain: 'journals.plos.org', name: 'PLOS ONE Open Access Research', category: 'Science', baseCredibility: 98, sourceType: 'Peer-Reviewed Public Library of Science', isPrimarySource: true },
  { domain: 'biomedcentral.com', name: 'BioMed Central Open Access', category: 'Science', baseCredibility: 97, sourceType: 'Peer-Reviewed Biomedical Research API', isPrimarySource: true },
  { domain: 'uspto.gov', name: 'USPTO Patent Bulk Storage', category: 'Tech', baseCredibility: 100, sourceType: 'US Official Patent & Trademark OCR Data', isPrimarySource: true },
  { domain: 'patents.google.com', name: 'Google Patents Datasets', category: 'Tech', baseCredibility: 99, sourceType: 'Global Patent Search & BigQuery Corpus', isPrimarySource: true },
  { domain: 'lens.org', name: 'The Lens Open Patent & Science API', category: 'Tech', baseCredibility: 98, sourceType: 'Global Patent & Academic Literature Infrastructure', isPrimarySource: true },
  { domain: 'openalex.org', name: 'OpenAlex Open Science Index', category: 'Science', baseCredibility: 99, sourceType: '250M Scholarly Works & Citation Graph API', isPrimarySource: true },
  { domain: 'europepmc.org', name: 'Europe PMC Biomedical Literature', category: 'Science', baseCredibility: 99, sourceType: 'European Open Access Life Sciences DB', isPrimarySource: true },
  { domain: 'ageconsearch.umn.edu', name: 'AgEcon Search Agricultural Economics', category: 'Finance', baseCredibility: 97, sourceType: 'University of Minnesota Agricultural Repository', isPrimarySource: true },
  { domain: 'philpapers.org', name: 'PhilPapers Philosophy Index', category: 'Science', baseCredibility: 98, sourceType: 'Global Philosophical Bibliography API', isPrimarySource: true },

  // Open Museums, Art & Archaeology APIs
  { domain: 'rijksmuseum.nl', name: 'Rijksmuseum Open API', category: 'Science', baseCredibility: 99, sourceType: 'Dutch National Museum Artifact & Art API', isPrimarySource: true },
  { domain: 'vam.ac.uk', name: 'Victoria and Albert Museum API', category: 'Science', baseCredibility: 99, sourceType: '5000-Year Design & Fashion History API', isPrimarySource: true },
  { domain: 'clevelandart.org', name: 'Cleveland Museum of Art API', category: 'Science', baseCredibility: 98, sourceType: 'Public Domain Masterpiece Open API', isPrimarySource: true },
  { domain: 'artic.edu', name: 'Art Institute of Chicago API', category: 'Science', baseCredibility: 98, sourceType: 'Chicago Art Institute Open JSON API', isPrimarySource: true },
  { domain: 'harvardartmuseums.org', name: 'Harvard Art Museums API', category: 'Science', baseCredibility: 99, sourceType: 'Harvard Art Collection Metadata API', isPrimarySource: true },
  { domain: 'kansallisgalleria.fi', name: 'Finnish National Gallery API', category: 'Science', baseCredibility: 98, sourceType: 'Nordic Art History Open Metadata', isPrimarySource: true },
  { domain: 'dare.ht.lu.se', name: 'Digital Atlas of the Roman Empire', category: 'Science', baseCredibility: 98, sourceType: 'Lund University Ancient Geographic GIS', isPrimarySource: true },
  { domain: 'opencontext.org', name: 'Open Context Archaeological Data', category: 'Science', baseCredibility: 98, sourceType: 'Open Excavation Field Records DB', isPrimarySource: true },
  { domain: 'archaeologydataservice.ac.uk', name: 'Archaeology Data Service UK', category: 'Science', baseCredibility: 98, sourceType: 'UK Official Archaeological Historic Records', isPrimarySource: true },

  // Specialized Technical & Software Wikis
  { domain: 'wiki.archlinux.org', name: 'ArchWiki Technical Documentation', category: 'Tech', baseCredibility: 98, sourceType: 'Linux Systems & Software Engineering Wiki', isPrimarySource: true },
  { domain: 'wiki.gentoo.org', name: 'Gentoo Linux Knowledge Base', category: 'Tech', baseCredibility: 97, sourceType: 'System Compilation & Kernel Docs Wiki', isPrimarySource: true },
  { domain: 'help.ubuntu.com', name: 'Ubuntu Documentation Wiki', category: 'Tech', baseCredibility: 96, sourceType: 'Official Linux Troubleshooting Reference', isPrimarySource: true },
  { domain: 'centos.org', name: 'CentOS Linux Wiki & Documentation', category: 'Tech', baseCredibility: 97, sourceType: 'Enterprise Linux Technical Docs', isPrimarySource: true },
  { domain: 'opensuse.org', name: 'openSUSE Documentation Wiki', category: 'Tech', baseCredibility: 97, sourceType: 'openSUSE Systems Engineering Wiki', isPrimarySource: true },
  { domain: 'haskell.org', name: 'Haskell Language Wiki', category: 'Tech', baseCredibility: 97, sourceType: 'Functional Programming Documentation', isPrimarySource: true },
  { domain: 'w3schools.com', name: 'W3Schools Web Developer Reference', category: 'Tech', baseCredibility: 90, sourceType: 'Web Engineering Tutorials', isPrimarySource: false },
  { domain: 'geeksforgeeks.org', name: 'GeeksforGeeks Computer Science Portal', category: 'Tech', baseCredibility: 91, sourceType: 'CS Engineering Knowledge Base', isPrimarySource: false },
  { domain: 'tutorialspoint.com', name: 'Tutorialspoint Developer Library', category: 'Tech', baseCredibility: 89, sourceType: 'Programming & Software Engineering Reference', isPrimarySource: false },
  { domain: 'javatpoint.com', name: 'JavaTpoint Software Tutorials', category: 'Tech', baseCredibility: 88, sourceType: 'Java & Tech Engineering Documentation', isPrimarySource: false },
  { domain: 'baeldung.com', name: 'Baeldung Java & Spring Engineering', category: 'Tech', baseCredibility: 94, sourceType: 'JVM & Backend Engineering Reference', isPrimarySource: true },
  { domain: 'stackexchange.com', name: 'Stack Exchange Q&A Network', category: 'Tech', baseCredibility: 93, sourceType: 'Crowdsourced Peer Q&A Archive', isPrimarySource: false },
  { domain: 'superuser.com', name: 'Super User Q&A', category: 'Tech', baseCredibility: 92, sourceType: 'Systems & Hardware IT Reference', isPrimarySource: false },
  { domain: 'serverfault.com', name: 'Server Fault Sysadmin Q&A', category: 'Tech', baseCredibility: 95, sourceType: 'System Administration Knowledge Base', isPrimarySource: true },
  { domain: 'askubuntu.com', name: 'Ask Ubuntu Q&A Knowledge Base', category: 'Tech', baseCredibility: 93, sourceType: 'Ubuntu Linux Peer Solutions', isPrimarySource: false },
  { domain: 'mathoverflow.net', name: 'MathOverflow Research Mathematics', category: 'Science', baseCredibility: 98, sourceType: 'Peer-Reviewed Mathematics Research Q&A', isPrimarySource: true },

  // Open Pop Culture, Cinema, Sports & Media Databases
  { domain: 'sports-reference.com', name: 'Sports-Reference Historical Stats', category: 'News', baseCredibility: 96, sourceType: 'Empirical Historical Sports Database', isPrimarySource: true },
  { domain: 'fbref.com', name: 'FBref Global Football Statistics', category: 'News', baseCredibility: 97, sourceType: 'Comprehensive International Football DB', isPrimarySource: true },
  { domain: 'pro-football-reference.com', name: 'Pro-Football-Reference NFL Stats', category: 'News', baseCredibility: 97, sourceType: 'NFL Historical Game & Player DB', isPrimarySource: true },
  { domain: 'hockey-reference.com', name: 'Hockey-Reference NHL Stats', category: 'News', baseCredibility: 97, sourceType: 'NHL Ice Hockey Historical DB', isPrimarySource: true },
  { domain: 'racing-reference.info', name: 'Racing-Reference Motorsports Stats', category: 'News', baseCredibility: 96, sourceType: 'NASCAR & F1 Historical Racing DB', isPrimarySource: true },
  { domain: 'baseball-reference.com', name: 'Baseball-Reference MLB Stats', category: 'News', baseCredibility: 98, sourceType: 'Official MLB Historical Records', isPrimarySource: true },
  { domain: 'basketball-reference.com', name: 'Basketball-Reference NBA Stats', category: 'News', baseCredibility: 98, sourceType: 'Official NBA Historical Records', isPrimarySource: true },
  { domain: 'the-numbers.com', name: 'The Numbers Box Office Research', category: 'Finance', baseCredibility: 95, sourceType: 'Empirical Cinema Financial & Revenue DB', isPrimarySource: true },
  { domain: 'boxofficemojo.com', name: 'Box Office Mojo Financial DB', category: 'Finance', baseCredibility: 96, sourceType: 'IMDb Pro Box Office Revenue DB', isPrimarySource: true },
  { domain: 'imdb.com', name: 'Internet Movie Database IMDb', category: 'News', baseCredibility: 94, sourceType: 'Global Film & Television Archive', isPrimarySource: true },
  { domain: 'rottentomatoes.com', name: 'Rotten Tomatoes Film Reviews', category: 'News', baseCredibility: 88, sourceType: 'Aggregated Critic Review Scores', isPrimarySource: false },
  { domain: 'metacritic.com', name: 'Metacritic Aggregated Reviews', category: 'News', baseCredibility: 89, sourceType: 'Aggregated Gaming & Media Metascore', isPrimarySource: false },
  { domain: 'allmusic.com', name: 'AllMusic Guide Discography', category: 'Science', baseCredibility: 93, sourceType: 'Music Biographies & Album Reviews', isPrimarySource: false },
  { domain: 'imcdb.org', name: 'Internet Movie Cars Database', category: 'Tech', baseCredibility: 92, sourceType: 'Automotive Cinema History Wiki', isPrimarySource: false },
  { domain: 'imfdb.org', name: 'Internet Movie Firearms Database', category: 'Tech', baseCredibility: 92, sourceType: 'Armament Media History Wiki', isPrimarySource: false },
  { domain: 'animeplanet.com', name: 'Anime-Planet Encyclopedia', category: 'Tech', baseCredibility: 93, sourceType: 'Anime & Manga Database', isPrimarySource: true },
  { domain: 'myanimelist.net', name: 'MyAnimeList Global Encyclopedia', category: 'Tech', baseCredibility: 94, sourceType: 'Japanese Animation Database & API', isPrimarySource: true },
  { domain: 'animenewsnetwork.com', name: 'Anime News Network Encyclopedia', category: 'Tech', baseCredibility: 94, sourceType: 'Japanese Animation Historical Encyclopedia', isPrimarySource: true },
  { domain: 'thetvdb.com', name: 'TheTVDB Television & Series DB', category: 'Tech', baseCredibility: 95, sourceType: 'Open Television Episode Metadata API', isPrimarySource: true },
  { domain: 'discogs.com', name: 'Discogs Music Release & Discography Dumps', category: 'Science', baseCredibility: 97, sourceType: 'Global Music Release Vinyl & CD DB', isPrimarySource: true },
  { domain: 'setlist.fm', name: 'Setlist.fm Concert Setlists Encyclopedia', category: 'Science', baseCredibility: 95, sourceType: 'Concert Performance History Archive', isPrimarySource: true },
  { domain: 'gamespot.com', name: 'GameSpot Video Game History', category: 'Tech', baseCredibility: 90, sourceType: 'Gaming Journalism & Reviews', isPrimarySource: false },
  { domain: 'vgmdb.net', name: 'Video Game Music Database VGMDb', category: 'Tech', baseCredibility: 95, sourceType: 'Video Game Discography & Soundtracks DB', isPrimarySource: true },

  // Specialized Open Encyclopedias & Independent Knowledge Systems
  { domain: 'orthodoxwiki.org', name: 'OrthodoxWiki Free Encyclopedia', category: 'Science', baseCredibility: 93, sourceType: 'Eastern Orthodox History & Theology Wiki', isPrimarySource: true },
  { domain: 'newadvent.org', name: 'Catholic Encyclopedia New Advent', category: 'Science', baseCredibility: 95, sourceType: 'Historical Public Domain Catholic Archive', isPrimarySource: true },
  { domain: 'jewishencyclopedia.com', name: 'Jewish Encyclopedia', category: 'Science', baseCredibility: 96, sourceType: 'Judaic Historical & Cultural Encyclopedia', isPrimarySource: true },
  { domain: 'islamicity.org', name: 'IslamiCity Encyclopedia', category: 'Science', baseCredibility: 92, sourceType: 'Islamic Historical & Cultural Library', isPrimarySource: false },
  { domain: 'encyclopediaofukraine.com', name: 'Encyclopedia of Ukraine', category: 'Science', baseCredibility: 96, sourceType: 'Canadian Institute of Ukrainian Studies', isPrimarySource: true },
  { domain: 'georgiaencyclopedia.org', name: 'New Georgia Encyclopedia', category: 'Science', baseCredibility: 95, sourceType: 'Georgia US Regional History DB', isPrimarySource: true },
  { domain: 'kiddle.co', name: 'Kiddle Educational Wiki', category: 'Science', baseCredibility: 91, sourceType: 'Simplified Educational Knowledge Base', isPrimarySource: false },
  { domain: 'sf-encyclopedia.com', name: 'The Encyclopedia of Science Fiction SFE', category: 'Science', baseCredibility: 98, sourceType: 'Peer-Reviewed Sci-Fi Literature History', isPrimarySource: true },

  // Specialized Archival Libraries, Museum APIs & Primary Texts
  { domain: 'oll.libertyfund.org', name: 'Online Library of Liberty OLL', category: 'Legal', baseCredibility: 97, sourceType: 'Economic & Political Thought Texts', isPrimarySource: true },
  { domain: 'britishmuseum.org', name: 'The British Museum Open Data', category: 'Science', baseCredibility: 99, sourceType: 'British Museum Artifact RDF/XML API', isPrimarySource: true },
  { domain: 'cudl.lib.cam.ac.uk', name: 'Cambridge Digital Library', category: 'Science', baseCredibility: 99, sourceType: 'Cambridge Newton & Darwin Archives', isPrimarySource: true },
  { domain: 'ota.bodleian.ox.ac.uk', name: 'Oxford Text Archive OTA', category: 'Science', baseCredibility: 99, sourceType: 'Oxford University Structued Text Archive', isPrimarySource: true },
  { domain: 'bodleian.ox.ac.uk', name: 'Bodleian Libraries Open Data', category: 'Science', baseCredibility: 99, sourceType: 'Oxford Manuscript & Early Books Catalog', isPrimarySource: true },
  { domain: 'library.wales', name: 'National Library of Wales', category: 'Science', baseCredibility: 98, sourceType: 'Welsh Press & Manuscript OAI-PMH', isPrimarySource: true },
  { domain: 'nls.uk', name: 'National Library of Scotland Data', category: 'Science', baseCredibility: 98, sourceType: 'Scottish Historical Maps & Manuscripts', isPrimarySource: true },
  { domain: 'dlg.usg.edu', name: 'Digital Library of Georgia', category: 'Science', baseCredibility: 96, sourceType: 'US Georgia State Historical Archive', isPrimarySource: true },
  { domain: 'calisphere.org', name: 'Calisphere University of California', category: 'Science', baseCredibility: 98, sourceType: 'UC System Digital Collections Portal', isPrimarySource: true },
  { domain: 'perseus.uchicago.edu', name: 'Perseus Under PhiloLogic Chicago', category: 'Science', baseCredibility: 99, sourceType: 'Classical Philology Text Server', isPrimarySource: true },

  // International Government Open Data Portals
  { domain: 'data.gov.be', name: 'Belgium Open Data Portal', category: 'Legal', baseCredibility: 99, sourceType: 'Official Belgian Government Public Data', isPrimarySource: true },
  { domain: 'data.gov.ie', name: 'Ireland Open Data Portal', category: 'Legal', baseCredibility: 99, sourceType: 'Official Irish Public Data & Demographics', isPrimarySource: true },
  { domain: 'opendata.swiss', name: 'Open Data Switzerland', category: 'Legal', baseCredibility: 99, sourceType: 'Official Swiss Federal Data Repository', isPrimarySource: true },
  { domain: 'data.gov.tw', name: 'Taiwan Open Data Portal', category: 'Legal', baseCredibility: 98, sourceType: 'Official Taiwan National Public Data', isPrimarySource: true },
  { domain: 'avoindata.fi', name: 'Open Data Finland', category: 'Legal', baseCredibility: 99, sourceType: 'Official Finnish Public Data Portal', isPrimarySource: true },
  { domain: 'data.gov.my', name: 'Malaysia Open Data Portal', category: 'Legal', baseCredibility: 98, sourceType: 'Official Malaysian Public Data', isPrimarySource: true },
  { domain: 'data.gov.th', name: 'Thailand Open Data Portal', category: 'Legal', baseCredibility: 97, sourceType: 'Official Thai Government Open Data', isPrimarySource: true },
  { domain: 'data.gov.hk', name: 'Open Data Hong Kong', category: 'Legal', baseCredibility: 98, sourceType: 'Official Hong Kong Urban & Historical Data', isPrimarySource: true },
  { domain: 'data.oecd.org', name: 'OECD Economic & Development Data', category: 'Finance', baseCredibility: 99, sourceType: 'OECD Socioeconomic Time Series API', isPrimarySource: true },
  { domain: 'data.unicef.org', name: 'UNICEF Global Health & Education', category: 'Science', baseCredibility: 99, sourceType: 'UNICEF International Child & Health Data', isPrimarySource: true },
  { domain: 'unctadstat.unctad.org', name: 'UNCTADstat Global Trade Statistics', category: 'Finance', baseCredibility: 99, sourceType: 'UN International Trade Data', isPrimarySource: true },
  { domain: 'eea.europa.eu', name: 'European Environment Agency EEA', category: 'Science', baseCredibility: 99, sourceType: 'EU Environmental Time-Series API', isPrimarySource: true },
  { domain: 'eia.gov', name: 'US Energy Information Administration', category: 'Finance', baseCredibility: 100, sourceType: 'Official US Energy & Commodity API', isPrimarySource: true },

  // Massive LLM Training & Knowledge Datasets
  { domain: 'oscar-project.org', name: 'OSCAR Multilingual Almanach Dataset', category: 'Tech', baseCredibility: 97, sourceType: 'Filtered Multilingual Web Corpus', isPrimarySource: true },
  { domain: 'rootsignals.ai', name: 'Root Signals Fact-Checking Corpus', category: 'Tech', baseCredibility: 96, sourceType: 'AI Fact-Verification Corpus', isPrimarySource: true },
  { domain: 'commons.dbpedia.org', name: 'DBpedia Commons Structured Media', category: 'Science', baseCredibility: 97, sourceType: 'Wikimedia Media Metadata DB', isPrimarySource: true },
  { domain: 'wordnet.princeton.edu', name: 'WordNet Princeton University', category: 'Science', baseCredibility: 99, sourceType: 'Lexical Lexicographical Knowledge Base', isPrimarySource: true },
  { domain: 'framenet.icsi.berkeley.edu', name: 'FrameNet UC Berkeley', category: 'Science', baseCredibility: 98, sourceType: 'Frame Semantic Lexical Database', isPrimarySource: true },
  { domain: 'cyc.com', name: 'OpenCyc Common-Sense Knowledge Base', category: 'Tech', baseCredibility: 97, sourceType: 'Structured Commonsense Knowledge Graph', isPrimarySource: true },
  { domain: 'gluebenchmark.com', name: 'GLUE / SuperGLUE Benchmark Corpus', category: 'Tech', baseCredibility: 98, sourceType: 'Language Understanding Test Sets', isPrimarySource: true },

  // Open Research, Patent Registries & Life Sciences
  { domain: 'scielo.org', name: 'SciELO Scientific Library', category: 'Science', baseCredibility: 98, sourceType: 'Latin American & Spanish Open Research', isPrimarySource: true },
  { domain: 'openaccessbutton.org', name: 'Open Access Button Registry', category: 'Science', baseCredibility: 96, sourceType: 'Open Scholarly Article Locator', isPrimarySource: true },
  { domain: 'doaj.org', name: 'Directory of Open Access Journals DOAJ', category: 'Science', baseCredibility: 98, sourceType: 'Curated Open Access Article Index', isPrimarySource: true },
  { domain: 'hal.science', name: 'HAL Science Ouverte France', category: 'Science', baseCredibility: 98, sourceType: 'French National Open Science Archive', isPrimarySource: true },
  { domain: 'wipo.int', name: 'WIPO World Intellectual Property', category: 'Tech', baseCredibility: 100, sourceType: 'Global Patent & Trademark Database', isPrimarySource: true },
  { domain: 'epo.org', name: 'European Patent Office EPO Data', category: 'Tech', baseCredibility: 100, sourceType: 'European Patent Bulk Dataset Portal', isPrimarySource: true },
  { domain: 'astrobiology.nasa.gov', name: 'NASA Astrobiology Open Portal', category: 'Science', baseCredibility: 99, sourceType: 'NASA Planetary Biology Dataset', isPrimarySource: true },

  // Museums, Fine Arts & Archaeological Catalogs
  { domain: 'thewalters.org', name: 'Walters Art Museum Open API', category: 'Science', baseCredibility: 98, sourceType: 'Ancient Egyptian & European Art API', isPrimarySource: true },
  { domain: 'cooperhewitt.org', name: 'Cooper Hewitt Design Museum API', category: 'Science', baseCredibility: 98, sourceType: 'Smithsonian Design History API', isPrimarySource: true },
  { domain: 'nga.gov', name: 'National Gallery of Art NGA Data', category: 'Science', baseCredibility: 99, sourceType: 'US National Gallery Art Open Set', isPrimarySource: true },
  { domain: 'artgallery.yale.edu', name: 'Yale University Art Gallery', category: 'Science', baseCredibility: 98, sourceType: 'Yale Art Artifact Open API', isPrimarySource: true },
  { domain: 'new.artsmia.org', name: 'Minneapolis Institute of Art MIA', category: 'Science', baseCredibility: 98, sourceType: 'MIA Global Art Collection API', isPrimarySource: true },
  { domain: 'nationalgallery.org.uk', name: 'The National Gallery London', category: 'Science', baseCredibility: 99, sourceType: 'European Painting History Archive', isPrimarySource: true },
  { domain: 'perio.do', name: 'Periodo Historical Period Gazeteer', category: 'Science', baseCredibility: 97, sourceType: 'Geospatial-Temporal Period DB', isPrimarySource: true },
  { domain: 'nomisma.org', name: 'Nomisma Numismatic Knowledge Graph', category: 'Science', baseCredibility: 98, sourceType: 'Greek & Roman Numismatic RDF', isPrimarySource: true },

  // Fandom & Community Media Encyclopedias
  { domain: 'onepiece.fandom.com', name: 'One Piece Manga Wiki', category: 'Tech', baseCredibility: 93, sourceType: 'Detailed Manga & Anime Knowledge Base', isPrimarySource: true },
  { domain: 'naruto.fandom.com', name: 'Naruto Wiki Knowledge Base', category: 'Tech', baseCredibility: 92, sourceType: 'Franchise Character & Lore DB', isPrimarySource: true },
  { domain: 'gameofthrones.fandom.com', name: 'A Song of Ice and Fire Wiki', category: 'Tech', baseCredibility: 93, sourceType: 'Westeros Lore & History Wiki', isPrimarySource: true },
  { domain: 'matrix.fandom.com', name: 'The Matrix Universe Wiki', category: 'Tech', baseCredibility: 91, sourceType: 'Matrix Franchise Lore Wiki', isPrimarySource: true },
  { domain: 'cyberpunk.fandom.com', name: 'Cyberpunk Lore Wiki', category: 'Tech', baseCredibility: 92, sourceType: 'Cyberpunk Lore & History DB', isPrimarySource: true },
  { domain: 'fedoraproject.org', name: 'Fedora Linux Technical Wiki', category: 'Tech', baseCredibility: 98, sourceType: 'RedHat & Fedora Engineering Docs', isPrimarySource: true },
  { domain: 'wiki.debian.org', name: 'Debian Operating System Wiki', category: 'Tech', baseCredibility: 98, sourceType: 'Debian Systems Engineering Wiki', isPrimarySource: true },
  { domain: 'freebsd.org', name: 'FreeBSD Technical Documentation', category: 'Tech', baseCredibility: 98, sourceType: 'UNIX & FreeBSD Systems Documentation', isPrimarySource: true },
  { domain: 'thepeerage.com', name: 'The Peerage Royal Genealogy', category: 'Science', baseCredibility: 95, sourceType: 'European Royal Lineage Archive', isPrimarySource: true },
  { domain: 'isfdb.org', name: 'Internet Speculative Fiction DB', category: 'Science', baseCredibility: 96, sourceType: 'Sci-Fi & Fantasy Publishing DB', isPrimarySource: true },

  // Historical Newspapers & Event Engines
  { domain: 'cdnc.ucr.edu', name: 'California Digital Newspaper Project', category: 'News', baseCredibility: 97, sourceType: 'UC Riverside Historic Press OCR', isPrimarySource: true },
  { domain: 'texashistory.unt.edu', name: 'Texas Digital Newspaper Program', category: 'News', baseCredibility: 97, sourceType: 'University of North Texas Newspaper Archive', isPrimarySource: true },
  { domain: 'digitalnewspapers.org', name: 'Utah Digital Newspapers', category: 'News', baseCredibility: 97, sourceType: 'Utah State Historic Press Archive', isPrimarySource: true },
  { domain: 'sos.wa.gov', name: 'Washington State Historic Newspapers', category: 'News', baseCredibility: 98, sourceType: 'Washington State Library Press OCR', isPrimarySource: true },
  { domain: 'paperspast.natlib.govt.nz', name: 'New Zealand Papers Past', category: 'News', baseCredibility: 98, sourceType: 'National Library of NZ Historic Press', isPrimarySource: true },
  { domain: 'anno.onb.ac.at', name: 'ANNO Austrian Newspapers Online', category: 'News', baseCredibility: 98, sourceType: 'Austrian National Library Historic Press', isPrimarySource: true },
  { domain: 'gdeltproject.org', name: 'GDELT Global Event Data', category: 'News', baseCredibility: 98, sourceType: 'Real-Time Global Mass Media Stream API', isPrimarySource: true },
  { domain: 'kiwix.org', name: 'Kiwix Offline Knowledge ZIM Dumps', category: 'Science', baseCredibility: 97, sourceType: 'Compressed Offline Encyclopedia DB', isPrimarySource: true },
  { domain: 'commoncrawl.org', name: 'Common Crawl URL Index API', category: 'Tech', baseCredibility: 98, sourceType: 'Global Web Capture Time-Series Index', isPrimarySource: true },

  // News OCR Archives & Wayback Machine APIs
  { domain: 'web.archive.org', name: 'Wayback Machine CDX API', category: 'Tech', baseCredibility: 100, sourceType: 'Internet Historical Capture Time-Series API', isPrimarySource: true },
  { domain: 'wikimedia.org', name: 'Wikimedia Dumps', category: 'Science', baseCredibility: 96, sourceType: 'Raw Encyclopedia Text Dumps', isPrimarySource: true },
  { domain: 'wikipedia.org', name: 'Wikipedia Free Encyclopedia', category: 'Science', baseCredibility: 92, sourceType: 'Collaborative Open Encyclopedia', isPrimarySource: false },
  { domain: 'vi.wikipedia.org', name: 'Wikipedia Việt Nam', category: 'Science', baseCredibility: 91, sourceType: 'Open Vietnamese Encyclopedia', isPrimarySource: false },
  { domain: 'wikidata.org', name: 'Wikidata Knowledge Graph', category: 'Science', baseCredibility: 97, sourceType: 'Structured Knowledge Graph DB', isPrimarySource: true },
  { domain: 'dbpedia.org', name: 'DBpedia SPARQL Knowledge Base', category: 'Science', baseCredibility: 96, sourceType: 'Extracted Wikipedia Graph Data', isPrimarySource: true },
  { domain: 'wiktionary.org', name: 'Wiktionary Dumps', category: 'Science', baseCredibility: 94, sourceType: 'Global Open Lexicography DB', isPrimarySource: true },
  { domain: 'wikiquote.org', name: 'Wikiquote Dumps', category: 'Science', baseCredibility: 93, sourceType: 'Historical Quotations Corpus', isPrimarySource: true },
  { domain: 'wikisource.org', name: 'Wikisource Dumps', category: 'Science', baseCredibility: 97, sourceType: 'Open Historical Source Texts', isPrimarySource: true },
  { domain: 'vi.wikisource.org', name: 'Wikisource Tiếng Việt', category: 'Science', baseCredibility: 97, sourceType: 'Tư Liệu Văn Bản Cổ Việt Nam', isPrimarySource: true },
  { domain: 'wikivoyage.org', name: 'Wikivoyage Dumps', category: 'Travel', baseCredibility: 92, sourceType: 'Open Travel Guide Dataset', isPrimarySource: false },
  { domain: 'wikibooks.org', name: 'Wikibooks Dumps', category: 'Science', baseCredibility: 93, sourceType: 'Open Textbook Repository', isPrimarySource: false },
  { domain: 'conservapedia.com', name: 'Conservapedia', category: 'Science', baseCredibility: 80, sourceType: 'Independent Political Encyclopedia', isPrimarySource: false },
  { domain: 'citizendium.org', name: 'Citizendium Expert Wiki', category: 'Science', baseCredibility: 94, sourceType: 'Expert-Guided Open Encyclopedia', isPrimarySource: true },
  { domain: 'baike.baidu.com', name: 'Baidu Baike', category: 'Science', baseCredibility: 89, sourceType: 'Chinese Cultural Encyclopedia', isPrimarySource: false },
  { domain: 'everipedia.org', name: 'Everipedia Blockchain Wiki', category: 'Science', baseCredibility: 88, sourceType: 'On-Chain Encyclopedia', isPrimarySource: false },
  { domain: 'scholarpedia.org', name: 'Scholarpedia Peer-Reviewed Wiki', category: 'Science', baseCredibility: 98, sourceType: 'Peer-Reviewed Academic Wiki', isPrimarySource: true },
  { domain: 'britannica.com', name: 'Encyclopedia Britannica Public', category: 'Science', baseCredibility: 96, sourceType: 'Academic Encyclopedia', isPrimarySource: true },
  { domain: 'newworldencyclopedia.org', name: 'New World Encyclopedia', category: 'Science', baseCredibility: 91, sourceType: 'Values-Filtered Knowledge Base', isPrimarySource: false },
  { domain: 'meta.wikimedia.org', name: 'Meta-Wiki Wikimedia', category: 'Tech', baseCredibility: 95, sourceType: 'Wikimedia Meta & Technical Wiki', isPrimarySource: true },
  { domain: 'mediawiki.org', name: 'MediaWiki Open API Sites', category: 'Tech', baseCredibility: 96, sourceType: 'MediaWiki Open API Standard', isPrimarySource: true },

  // Open Libraries, History & OCR Texts
  { domain: 'openlibrary.org', name: 'Open Library Internet Archive', category: 'Science', baseCredibility: 97, sourceType: 'Global Catalog & Ebook JSON Data', isPrimarySource: true },
  { domain: 'hathitrust.org', name: 'HathiTrust Digital Library', category: 'Science', baseCredibility: 98, sourceType: 'University Academic Text Repository', isPrimarySource: true },
  { domain: 'perseus.tufts.edu', name: 'Perseus Digital Library', category: 'Science', baseCredibility: 99, sourceType: 'Classical Mediterranean History Library', isPrimarySource: true },
  { domain: 'europeana.eu', name: 'Europeana Collections', category: 'Science', baseCredibility: 97, sourceType: 'EU Cultural Heritage & Museum Portal', isPrimarySource: true },
  { domain: 'bl.uk', name: 'British Library Open Data', category: 'Science', baseCredibility: 98, sourceType: 'National Library Historical Archive', isPrimarySource: true },
  { domain: 'loc.gov', name: 'Library of Congress Open Data', category: 'Legal', baseCredibility: 99, sourceType: 'US National Historical Archive & API', isPrimarySource: true },
  { domain: 'gallica.bnf.fr', name: 'Gallica BnF France', category: 'Science', baseCredibility: 98, sourceType: 'French National Library OAI-PMH', isPrimarySource: true },
  { domain: 'nationalarchives.gov.uk', name: 'The National Archives UK', category: 'Legal', baseCredibility: 99, sourceType: 'UK Official Record Archives', isPrimarySource: true },
  { domain: 'dp.la', name: 'Digital Public Library of America', category: 'Science', baseCredibility: 97, sourceType: 'US Museum & Library API Portal', isPrimarySource: true },
  { domain: 'wdl.org', name: 'World Digital Library UNESCO', category: 'Science', baseCredibility: 98, sourceType: 'Global Cultural Heritage Archive', isPrimarySource: true },
  { domain: 'standardebooks.org', name: 'Standard Ebooks', category: 'Science', baseCredibility: 96, sourceType: 'Clean Code Public Domain Literature', isPrimarySource: true },
  { domain: 'loyalbooks.com', name: 'Loyal Books Audio & Text', category: 'Science', baseCredibility: 92, sourceType: 'Public Domain Text & Audiobooks', isPrimarySource: false },

  // Open AI & Scientific Datasets
  { domain: 'huggingface.co', name: 'Hugging Face Open Datasets', category: 'Tech', baseCredibility: 97, sourceType: 'Machine Learning Text & Dump Hub', isPrimarySource: true },
  { domain: 'kaggle.com', name: 'Kaggle Datasets Hub', category: 'Tech', baseCredibility: 95, sourceType: 'Data Science Community Open Sets', isPrimarySource: true },
  { domain: 'datasetsearch.research.google.com', name: 'Google Dataset Search', category: 'Science', baseCredibility: 96, sourceType: 'Global Index of Scientific Datasets', isPrimarySource: true },
  { domain: 'archive.ics.uci.edu', name: 'UCI Machine Learning Repository', category: 'Tech', baseCredibility: 98, sourceType: 'Classic Academic Benchmark Datasets', isPrimarySource: true },
  { domain: 'data.world', name: 'Data.world Cloud Data', category: 'Tech', baseCredibility: 92, sourceType: 'SQL-Queryable Dataset Repository', isPrimarySource: false },
  { domain: 'zenodo.org', name: 'Zenodo CERN Open Research', category: 'Science', baseCredibility: 98, sourceType: 'Permanent Scientific Record Repository', isPrimarySource: true },
  { domain: 'figshare.com', name: 'Figshare Academic Repository', category: 'Science', baseCredibility: 96, sourceType: 'Academic Output & Raw Data Files', isPrimarySource: true },
  { domain: 'dataverse.harvard.edu', name: 'Harvard Dataverse', category: 'Science', baseCredibility: 99, sourceType: 'Harvard University Data Archive', isPrimarySource: true },
  { domain: 'datadryad.org', name: 'Dryad Digital Repository', category: 'Science', baseCredibility: 97, sourceType: 'Curated Scientific Open Datasets', isPrimarySource: true },
  { domain: 'semanticscholar.org', name: 'Semantic Scholar S2ORC Corpus', category: 'Science', baseCredibility: 97, sourceType: 'Structured Academic JSON Corpus', isPrimarySource: true },
  { domain: 'core.ac.uk', name: 'CORE Global Research Outputs', category: 'Science', baseCredibility: 98, sourceType: 'World Largest Open Research Aggregator', isPrimarySource: true },
  { domain: 'openaire.eu', name: 'OpenAIRE Infrastructure', category: 'Science', baseCredibility: 97, sourceType: 'European Open Science Portal', isPrimarySource: true },

  // Government Open Data Portals
  { domain: 'data.gov', name: 'US Government Open Data', category: 'Legal', baseCredibility: 99, sourceType: 'Official US Public Data Portal', isPrimarySource: true },
  { domain: 'data.gov.uk', name: 'UK Government Open Data', category: 'Legal', baseCredibility: 99, sourceType: 'Official UK Public Data Portal', isPrimarySource: true },
  { domain: 'data.gouv.fr', name: 'French Government Open Data', category: 'Legal', baseCredibility: 99, sourceType: 'Official French Public Data Portal', isPrimarySource: true },
  { domain: 'data.gov.vn', name: 'Cổng Dữ Liệu Mở Việt Nam', category: 'Legal', baseCredibility: 98, sourceType: 'Cổng Dữ Liệu Quốc Gia Việt Nam', isPrimarySource: true },
  { domain: 'opendata.hanoi.gov.vn', name: 'Open Data Thành Phố Hà Nội', category: 'Legal', baseCredibility: 97, sourceType: 'Dữ Liệu Đô Thị & Lịch Sử Hà Nội', isPrimarySource: true },
  { domain: 'data.hochiminhcity.gov.vn', name: 'Open Data Thành Phố Hồ Chí Minh', category: 'Legal', baseCredibility: 97, sourceType: 'Dữ Liệu Đô Thị & Thống Kê TP.HCM', isPrimarySource: true },
  { domain: 'data.europa.eu', name: 'EU Open Data Portal', category: 'Legal', baseCredibility: 99, sourceType: 'Official European Union Data Repository', isPrimarySource: true },
  { domain: 'data.go.jp', name: 'Japan Open Data Portal', category: 'Legal', baseCredibility: 98, sourceType: 'Official Japanese Public Data Portal', isPrimarySource: true },
  { domain: 'data.gov.au', name: 'Australian Government Open Data', category: 'Legal', baseCredibility: 98, sourceType: 'Official Australian Public Data', isPrimarySource: true },
  { domain: 'ourworldindata.org', name: 'Our World in Data Oxford', category: 'Science', baseCredibility: 99, sourceType: 'Global Empirical Social & Science Data', isPrimarySource: true },
  { domain: 'worldbank.org', name: 'World Bank Open Data', category: 'Finance', baseCredibility: 99, sourceType: 'Global Economic & Socioeconomic Statistics', isPrimarySource: true },
  { domain: 'imf.org', name: 'IMF Global Financial Data', category: 'Finance', baseCredibility: 99, sourceType: 'International Monetary Statistics', isPrimarySource: true },
  { domain: 'data.un.org', name: 'UN Data Portal', category: 'Legal', baseCredibility: 99, sourceType: 'United Nations Global Statistics', isPrimarySource: true },
  { domain: 'uis.unesco.org', name: 'UNESCO Institute for Statistics', category: 'Science', baseCredibility: 98, sourceType: 'Global Culture & Education Data', isPrimarySource: true },
  { domain: 'fao.org', name: 'FAOSTAT Food & Agriculture', category: 'Science', baseCredibility: 98, sourceType: 'UN Food & Agricultural Historical DB', isPrimarySource: true },

  // Museum, Geography & Cultural Vocabularies
  { domain: 'si.edu', name: 'Smithsonian Open Access', category: 'Science', baseCredibility: 99, sourceType: 'US Smithsonian Institution Open Data', isPrimarySource: true },
  { domain: 'metmuseum.org', name: 'The Met Museum Open Access', category: 'Science', baseCredibility: 98, sourceType: 'Metropolitan Museum Art & Artifact API', isPrimarySource: true },
  { domain: 'getty.edu', name: 'Getty Vocabularies', category: 'Science', baseCredibility: 98, sourceType: 'Art & Architectural History Thesaurus', isPrimarySource: true },
  { domain: 'geofabrik.de', name: 'OpenStreetMap Geofabrik Dumps', category: 'Travel', baseCredibility: 97, sourceType: 'Open Geographic & Monument Dumps', isPrimarySource: true },
  { domain: 'geonames.org', name: 'GeoNames Geographical Database', category: 'Travel', baseCredibility: 97, sourceType: 'Historical & Current Toponym DB', isPrimarySource: true },
  { domain: 'pleiades.stoa.org', name: 'Pleiades Ancient Geography', category: 'Science', baseCredibility: 98, sourceType: 'Ancient Mediterranean Places Gazetteer', isPrimarySource: true },
  { domain: 'chroniclingamerica.loc.gov', name: 'Chronicling America Historic Newspapers', category: 'News', baseCredibility: 98, sourceType: 'US Historical Press OCR Archive', isPrimarySource: true },
  { domain: 'trove.nla.gov.au', name: 'Trove National Library of Australia', category: 'Science', baseCredibility: 98, sourceType: 'Australian Cultural & Newspaper API', isPrimarySource: true },
  { domain: 'oldmapsonline.org', name: 'OldMapsOnline Historical Maps', category: 'Travel', baseCredibility: 96, sourceType: 'Geospatial Cartographic Archive', isPrimarySource: true },

  // Investigative & Open Journalism
  { domain: 'propublica.org', name: 'ProPublica Data Store', category: 'News', baseCredibility: 96, sourceType: 'Nonprofit Investigative Journalism DB', isPrimarySource: true },
  { domain: 'fivethirtyeight.com', name: 'FiveThirtyEight Open Data', category: 'News', baseCredibility: 93, sourceType: 'Data-Driven Political & Historical Data', isPrimarySource: true },
  { domain: 'theguardian.com', name: 'The Guardian Open Platform', category: 'News', baseCredibility: 92, sourceType: 'Guardian Open API Article Archives', isPrimarySource: true },
  { domain: 'developer.nytimes.com', name: 'NYT Developer Network API', category: 'News', baseCredibility: 93, sourceType: '1851-Present Newspaper API Archives', isPrimarySource: true },
  { domain: 'wikileaks.org', name: 'WikiLeaks Public Archives', category: 'News', baseCredibility: 90, sourceType: 'Declassified & Leaked Document Corpus', isPrimarySource: true },

  // Community & Niche Wikis
  { domain: 'fandom.com', name: 'Fandom / Wikia Open Dumps', category: 'Tech', baseCredibility: 85, sourceType: 'Pop Culture & Media Community Wiki', isPrimarySource: false },
  { domain: 'memory-alpha.fandom.com', name: 'Memory Alpha Star Trek Wiki', category: 'Tech', baseCredibility: 92, sourceType: 'Curated Franchise Knowledge Base', isPrimarySource: true },
  { domain: 'starwars.fandom.com', name: 'Wookieepedia Star Wars Wiki', category: 'Tech', baseCredibility: 92, sourceType: 'Curated Star Wars Universe Wiki', isPrimarySource: true },
  { domain: 'tolkiengateway.net', name: 'Tolkien Gateway Encyclopedia', category: 'Science', baseCredibility: 93, sourceType: 'Middle-Earth Literary Knowledge Base', isPrimarySource: true },
  { domain: 'liquipedia.net', name: 'Liquipedia Esports Wiki', category: 'Tech', baseCredibility: 94, sourceType: 'Esports History & Match Records', isPrimarySource: true },
  { domain: 'musicbrainz.org', name: 'MusicBrainz Open Music DB', category: 'Tech', baseCredibility: 97, sourceType: 'Crowdsourced Music Discography DB', isPrimarySource: true },
  { domain: 'bookbrainz.org', name: 'BookBrainz Open Literature DB', category: 'Science', baseCredibility: 95, sourceType: 'Crowdsourced Bibliographic DB', isPrimarySource: true },
  { domain: 'omdbapi.com', name: 'OMDb Open Movie Database', category: 'Tech', baseCredibility: 92, sourceType: 'Movie & Cinema Metadata API', isPrimarySource: false },
  { domain: 'themoviedb.org', name: 'TMDb Open Movie Database', category: 'Tech', baseCredibility: 94, sourceType: 'Cinema & TV History API', isPrimarySource: true },
  { domain: 'giantbomb.com', name: 'Giant Bomb Video Game Wiki', category: 'Tech', baseCredibility: 92, sourceType: 'Video Game History & Platform DB', isPrimarySource: true },

  // Life Sciences & Natural History
  { domain: 'pmc.ncbi.nlm.nih.gov', name: 'PubMed Central Open Full Text', category: 'Science', baseCredibility: 100, sourceType: 'Biomedical Open Full Text Repository', isPrimarySource: true },
  { domain: 'species.wikimedia.org', name: 'Wikispecies Taxonomy Wiki', category: 'Science', baseCredibility: 97, sourceType: 'Open Taxonomic Hierarchy DB', isPrimarySource: true },
  { domain: 'eol.org', name: 'Encyclopedia of Life', category: 'Science', baseCredibility: 97, sourceType: 'Global Biodiversity Encyclopedia', isPrimarySource: true },
  { domain: 'gbif.org', name: 'GBIF Biodiversity Facility', category: 'Science', baseCredibility: 98, sourceType: 'Global Biodiversity Occurrence Data', isPrimarySource: true },
  { domain: 'pubchem.ncbi.nlm.nih.gov', name: 'PubChem Chemical DB', category: 'Science', baseCredibility: 99, sourceType: 'National Chemical Compound DB', isPrimarySource: true },
  { domain: 'chemspider.com', name: 'ChemSpider Royal Society', category: 'Science', baseCredibility: 98, sourceType: 'RSC Open Chemical Database', isPrimarySource: true },
  { domain: 'data.nasa.gov', name: 'NASA Open Data Portal', category: 'Science', baseCredibility: 99, sourceType: 'Space & Planetary Science Open Data', isPrimarySource: true },

  // Finance / Investing
  { domain: 'sec.gov', name: 'SEC EDGAR Database', category: 'Finance', baseCredibility: 100, sourceType: 'Official Government Filing (10-K / 10-Q)', isPrimarySource: true },
  { domain: 'investor.apple.com', name: 'Apple Investor Relations', category: 'Finance', baseCredibility: 98, sourceType: 'Corporate Financials', isPrimarySource: true },
  { domain: 'bloomberg.com', name: 'Bloomberg Financial', category: 'Finance', baseCredibility: 94, sourceType: 'Financial News & Terminal', isPrimarySource: false },
  { domain: 'reuters.com', name: 'Reuters Financial News', category: 'Finance', baseCredibility: 96, sourceType: 'Global Wire Service', isPrimarySource: true },
  { domain: 'wsj.com', name: 'The Wall Street Journal', category: 'Finance', baseCredibility: 93, sourceType: 'Business & Market News', isPrimarySource: false },
  { domain: 'federalreserve.gov', name: 'Federal Reserve System', category: 'Finance', baseCredibility: 99, sourceType: 'Central Bank Macro Data', isPrimarySource: true },
  { domain: 'morningstar.com', name: 'Morningstar Research', category: 'Finance', baseCredibility: 91, sourceType: 'Investment Analytics', isPrimarySource: false },
  { domain: 'finance.yahoo.com', name: 'Yahoo Finance Aggregated', category: 'Finance', baseCredibility: 85, sourceType: 'Aggregated Market Data', isPrimarySource: false },
  { domain: 'ft.com', name: 'Financial Times', category: 'Finance', baseCredibility: 94, sourceType: 'Global Financial Press', isPrimarySource: false },
  { domain: 'marketwatch.com', name: 'MarketWatch', category: 'Finance', baseCredibility: 88, sourceType: 'Real-time Financial News', isPrimarySource: false },

  // Science / Health
  { domain: 'pubmed.ncbi.nlm.nih.gov', name: 'PubMed Central', category: 'Science', baseCredibility: 99, sourceType: 'Peer-Reviewed Literature Database', isPrimarySource: true },
  { domain: 'cdc.gov', name: 'Centers for Disease Control', category: 'Science', baseCredibility: 98, sourceType: 'Public Health Agency Guidance', isPrimarySource: true },
  { domain: 'who.int', name: 'World Health Organization', category: 'Science', baseCredibility: 97, sourceType: 'Global Health Authority', isPrimarySource: true },
  { domain: 'nih.gov', name: 'National Institutes of Health', category: 'Science', baseCredibility: 99, sourceType: 'Federal Biomedical Research', isPrimarySource: true },
  { domain: 'nature.com', name: 'Nature Journal', category: 'Science', baseCredibility: 98, sourceType: 'Primary Research Journal', isPrimarySource: true },
  { domain: 'science.org', name: 'Science AAAS Journal', category: 'Science', baseCredibility: 98, sourceType: 'Peer-Reviewed Scientific Journal', isPrimarySource: true },
  { domain: 'jamanetwork.com', name: 'JAMA Network', category: 'Science', baseCredibility: 97, sourceType: 'Medical Association Journal', isPrimarySource: true },
  { domain: 'cochranelibrary.com', name: 'Cochrane Library', category: 'Science', baseCredibility: 99, sourceType: 'Evidence-Based Meta Analysis', isPrimarySource: true },
  { domain: 'mayoclinic.org', name: 'Mayo Clinic Clinical Research', category: 'Science', baseCredibility: 95, sourceType: 'Academic Medical Center', isPrimarySource: true },
  { domain: 'hopkinsmedicine.org', name: 'Johns Hopkins Medicine', category: 'Science', baseCredibility: 96, sourceType: 'University Health Research', isPrimarySource: true },
  { domain: 'arxiv.org', name: 'arXiv Preprint Server', category: 'Science', baseCredibility: 91, sourceType: 'Scientific Preprint Server', isPrimarySource: true },
  { domain: 'sciencedirect.com', name: 'ScienceDirect Elsevier', category: 'Science', baseCredibility: 96, sourceType: 'Peer-Reviewed Journal Repository', isPrimarySource: true },

  // Current Events / News
  { domain: 'apnews.com', name: 'Associated Press Wire', category: 'News', baseCredibility: 97, sourceType: 'Fact-Based Wire Reporter', isPrimarySource: true },
  { domain: 'nytimes.com', name: 'The New York Times', category: 'News', baseCredibility: 92, sourceType: 'Investigative News Outlet', isPrimarySource: false },
  { domain: 'washingtonpost.com', name: 'The Washington Post', category: 'News', baseCredibility: 91, sourceType: 'National News Reporting', isPrimarySource: false },
  { domain: 'bbc.com', name: 'BBC World News', category: 'News', baseCredibility: 93, sourceType: 'Public Broadcaster', isPrimarySource: false },
  { domain: 'vnexpress.net', name: 'VnExpress News', category: 'News', baseCredibility: 88, sourceType: 'Major Vietnamese News Portal', isPrimarySource: false },
  { domain: 'tuoitre.vn', name: 'Tuổi Trẻ Online', category: 'News', baseCredibility: 87, sourceType: 'National Vietnamese Press', isPrimarySource: false },
  { domain: 'thanhnien.vn', name: 'Thanh Niên News', category: 'News', baseCredibility: 86, sourceType: 'National Vietnamese Press', isPrimarySource: false },

  // Legal / Regulatory
  { domain: 'congress.gov', name: 'Congress.gov Legislative Text', category: 'Legal', baseCredibility: 100, sourceType: 'Federal Legislative Database', isPrimarySource: true },
  { domain: 'eur-lex.europa.eu', name: 'EUR-Lex EU Law', category: 'Legal', baseCredibility: 100, sourceType: 'Official European Union Law', isPrimarySource: true },
  { domain: 'supremecourt.gov', name: 'Supreme Court of the US', category: 'Legal', baseCredibility: 100, sourceType: 'Official Judicial Records', isPrimarySource: true },
  { domain: 'law.cornell.edu', name: 'Legal Information Institute', category: 'Legal', baseCredibility: 95, sourceType: 'Legal Code & Case Law', isPrimarySource: true },
  { domain: 'gov.uk', name: 'UK Government Portal', category: 'Legal', baseCredibility: 99, sourceType: 'Official Government Portal', isPrimarySource: true },

  // Shopping / Product Research
  { domain: 'wirecutter.com', name: 'NYT Wirecutter Reviews', category: 'Shopping', baseCredibility: 92, sourceType: 'Independent Product Testing', isPrimarySource: false },
  { domain: 'consumerreports.org', name: 'Consumer Reports', category: 'Shopping', baseCredibility: 95, sourceType: 'Non-Profit Product Testing Lab', isPrimarySource: true },
  { domain: 'rtings.com', name: 'RTINGS Lab Tests', category: 'Shopping', baseCredibility: 93, sourceType: 'Empirical Hardware Benchmarks', isPrimarySource: true },
  { domain: 'apple.com', name: 'Apple Official Product Specs', category: 'Shopping', baseCredibility: 99, sourceType: 'Manufacturer Official Specs', isPrimarySource: true },
  { domain: 'samsung.com', name: 'Samsung Electronics Official', category: 'Shopping', baseCredibility: 99, sourceType: 'Manufacturer Official Specs', isPrimarySource: true },
  { domain: 'sony.com', name: 'Sony Official Hardware Specs', category: 'Shopping', baseCredibility: 98, sourceType: 'Manufacturer Official Specs', isPrimarySource: true },

  // Travel
  { domain: 'lonelyplanet.com', name: 'Lonely Planet Guides', category: 'Travel', baseCredibility: 89, sourceType: 'Travel Research Guide', isPrimarySource: false },
  { domain: 'nationalgeographic.com', name: 'National Geographic Travel', category: 'Travel', baseCredibility: 94, sourceType: 'Geographic & Cultural Research', isPrimarySource: false },
  { domain: 'maps.google.com', name: 'Google Places Dataset', category: 'Travel', baseCredibility: 91, sourceType: 'Location & Merchant Verification', isPrimarySource: true },
  { domain: 'travel.state.gov', name: 'US Travel Advisory', category: 'Travel', baseCredibility: 98, sourceType: 'Official Government Travel Advisory', isPrimarySource: true },
  { domain: 'vietnamtourism.gov.vn', name: 'Vietnam National Authority of Tourism', category: 'Travel', baseCredibility: 96, sourceType: 'Official Tourism Board', isPrimarySource: true }
];

export function findDomainProfile(domainStr: string): DomainProfile | null {
  const cleanDomain = domainStr.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  const found = CREDIBLE_DOMAINS.find(d => cleanDomain.includes(d.domain) || d.domain.includes(cleanDomain));
  if (found) return found;

  if (cleanDomain.endsWith('.gov')) {
    return {
      domain: cleanDomain,
      name: `Government Agency (${cleanDomain})`,
      category: 'Legal',
      baseCredibility: 98,
      sourceType: 'Official Government Domain',
      isPrimarySource: true
    };
  }

  if (cleanDomain.endsWith('.edu')) {
    return {
      domain: cleanDomain,
      name: `Academic Institution (${cleanDomain})`,
      category: 'Science',
      baseCredibility: 94,
      sourceType: 'University Research Domain',
      isPrimarySource: true
    };
  }

  return null;
}
