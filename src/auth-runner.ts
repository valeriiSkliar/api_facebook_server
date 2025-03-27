// // src/auth-runner.ts
// import * as dotenv from 'dotenv';
// import * as puppeteer from 'puppeteer';
// import * as fs from 'fs';
// import * as path from 'path';

// // Load environment variables
// dotenv.config();

// // Type definitions for Facebook Ads Library API response
// interface FacebookAdNode {
//   ad_archive_id: string;
//   ad_id: string | null;
//   archive_types: string[];
//   categories: string[];
//   collation_count: number;
//   collation_id: string;
//   contains_digital_created_media: boolean;
//   contains_sensitive_content: boolean;
//   currency: string;
//   end_date: number;
//   entity_type: string;
//   fev_info: any;
//   gated_type: string;
//   has_user_reported: boolean;
//   hidden_safety_data: boolean;
//   hide_data_status: string;
//   impressions_with_index: {
//     impressions_text: string | null;
//     impressions_index: number;
//   };
//   is_aaa_eligible: boolean;
//   is_active: boolean;
//   is_profile_page: boolean;
//   menu_items: any[];
//   page_id: string;
//   page_is_deleted: boolean;
//   page_name: string;
//   political_countries: string[];
//   publisher_platform: string[];
//   reach_estimate: any;
//   regional_regulation_data: any;
//   report_count: any;
//   snapshot: any;
//   spend: any;
//   start_date: number;
//   state_media_run_label: any;
//   targeted_or_reached_countries: string[];
//   total_active_time?: number;
//   __typename?: string;
// }

// interface FacebookAdEdge {
//   node: {
//     collated_results: FacebookAdNode[];
//     __typename: string;
//   };
//   cursor: string | null;
// }

// interface FacebookAdLibraryResponse {
//   data: {
//     ad_library_main: {
//       search_results_connection: {
//         edges: FacebookAdEdge[];
//       };
//     };
//   };
// }

// /**
//  * Main function to run the Facebook Ads Library scraper
//  */
// async function runFacebookScraper(options: {
//   country?: string;
//   activeStatus: 'active' | 'inactive';
//   ad_type: 'political_and_issue_ads' | 'all';
//   is_targeted_country: boolean;
//   media_type: 'all';
//   q: string;
//   search_type: 'keyword_unordered';
// }) {
//   const {
//     country = 'ALL',
//     activeStatus,
//     ad_type,
//     is_targeted_country,
//     media_type,
//     q,
//     search_type,
//   } = options;

//   // Construct the URL for Facebook Ads Library
//   const url = `https://www.facebook.com/ads/library/?active_status=${activeStatus}&ad_type=${ad_type}&country=${country}&is_targeted_country=${is_targeted_country}&media_type=${media_type}&q=${q}&search_type=${search_type}`;

//   console.log(`Starting Facebook Ads Library scraper for query: ${q}`);
//   console.log(`URL: ${url}`);

//   // Launch browser
//   const browser = await puppeteer.launch({
//     headless: false, // Set to true for production
//     args: [
//       '--no-sandbox',
//       '--disable-setuid-sandbox',
//       '--disable-dev-shm-usage',
//       '--disable-gpu',
//       '--disable-web-security',
//       '--disable-features=IsolateOrigins,site-per-process',
//       '--window-size=1920,1080',
//       '--start-maximized',
//     ],
//     defaultViewport: {
//       width: 1920,
//       height: 1080,
//     },
//     timeout: 120000,
//   });

//   // Collection to store all ad nodes
//   const allAdNodes: FacebookAdNode[] = [];

//   try {
//     const page = await browser.newPage();

//     // Set viewport
//     await page.setViewport({ width: 1920, height: 1080 });

//     // Add request logging
//     page.on('request', (request) => {
//       if (request.url().includes('facebook.com/api/graphql/')) {
//         console.log('GraphQL Request URL:', request.url());
//         console.log('GraphQL Request Headers:', request.headers());
//         console.log('GraphQL Request Post Data:', request.postData());
//       }
//       request.continue();
//     });

//     // Add response logging
//     page.on('response', async (response) => {
//       const url = response.url();
//       if (url.includes('facebook.com/api/graphql/')) {
//         console.log('GraphQL Response URL:', url);
//         console.log('GraphQL Response Status:', response.status());
//         try {
//           const text = await response.text();
//           console.log('GraphQL Response Preview:', text.substring(0, 200));
//         } catch (err) {
//           console.error('Error reading response:', err);
//         }
//       }
//     });

//     // Set up request interception
//     await page.setRequestInterception(true);

//     // Navigate to the Facebook Ads Library page
//     console.log('Navigating to Facebook Ads Library...');
//     try {
//       // Accept cookies if present
//       const acceptCookiesSelector =
//         '[data-testid="cookie-policy-manage-dialog-accept-button"]';
//       await page.goto(url, {
//         waitUntil: ['networkidle0', 'domcontentloaded'],
//         timeout: 120000,
//       });

//       // Wait for and click accept cookies button if it exists
//       try {
//         await page.waitForSelector(acceptCookiesSelector, { timeout: 5000 });
//         await page.click(acceptCookiesSelector);
//         console.log('Accepted cookies');
//       } catch (cookieError) {
//         console.log('No cookie banner found or already accepted');
//       }

//       // Wait additional time for dynamic content to load
//       await new Promise((resolve) => setTimeout(resolve, 5000));

//       // Check if we need to handle login
//       const loginButton = await page.$('[data-testid="royal_login_button"]');
//       if (loginButton) {
//         console.log('Login required - Facebook is requesting authentication');
//         throw new Error('Facebook authentication required');
//       }
//     } catch (navigationError) {
//       console.error('Navigation error:', navigationError);
//       // Try one more time with different wait conditions
//       try {
//         await page.goto(url, {
//           waitUntil: 'domcontentloaded',
//           timeout: 60000,
//         });
//       } catch (retryError) {
//         console.error('Retry navigation failed:', retryError);
//         throw new Error('Failed to load Facebook Ads Library after retries');
//       }
//     }

//     // Wait for the page to load initial content
//     console.log('Waiting for initial content to load...');
//     try {
//       // Wait for either the main content or the login button
//       await Promise.race([
//         page.waitForSelector('[role="main"]', { timeout: 60000 }),
//         page.waitForSelector('[data-testid="royal_login_button"]', {
//           timeout: 60000,
//         }),
//       ]);

//       // Check if we landed on login page
//       const loginButton = await page.$('[data-testid="royal_login_button"]');
//       if (loginButton) {
//         throw new Error('Facebook authentication required');
//       }
//     } catch (selectorError) {
//       console.warn(
//         'Timeout waiting for main content selector. Continuing anyway...',
//       );
//       if (allAdNodes.length > 0) {
//         console.log(
//           `Already collected ${allAdNodes.length} ads before timeout. Continuing...`,
//         );
//       }
//     }

//     // Listen for responses to capture ad data
//     // eslint-disable-next-line @typescript-eslint/no-misused-promises
//     page.on('response', async (response) => {
//       const url = response.url();

//       // Only process GraphQL API responses that contain ad data
//       if (
//         url.includes('facebook.com/api/graphql/') &&
//         response.request().method() === 'POST'
//       ) {
//         try {
//           const responseText = await response.text();

//           // Check if the response contains ad data
//           if (
//             responseText.includes('ad_library_main') &&
//             responseText.includes('search_results_connection')
//           ) {
//             console.log('Intercepted ad data response');

//             try {
//               // Sometimes responses might have non-standard JSON characters
//               try {
//                 const responseJson = JSON.parse(
//                   responseText,
//                 ) as FacebookAdLibraryResponse;

//                 // Extract ad nodes from the response
//                 if (
//                   responseJson.data?.ad_library_main?.search_results_connection
//                     ?.edges &&
//                   Array.isArray(
//                     responseJson.data.ad_library_main.search_results_connection
//                       .edges,
//                   )
//                 ) {
//                   const edges =
//                     responseJson.data.ad_library_main.search_results_connection
//                       .edges;

//                   // Process each edge
//                   for (const edge of edges) {
//                     if (
//                       edge.node?.collated_results &&
//                       Array.isArray(edge.node.collated_results)
//                     ) {
//                       // Add each ad to our collection
//                       allAdNodes.push(...edge.node.collated_results);
//                       console.log(`Total ads collected: ${allAdNodes.length}`);

//                       // If we've collected 200 or more ads, we can stop
//                       if (allAdNodes.length >= 200) {
//                         console.log(
//                           'Reached target of 200 ads. Saving data...',
//                         );
//                         await saveResults(allAdNodes, q);
//                         await browser.close();
//                         return;
//                       }
//                     }
//                   }
//                 }
//               } catch (parseError) {
//                 console.error('Error parsing response JSON:', parseError);

//                 // Log a small portion of the problematic response to help debug
//                 if (responseText.length > 0) {
//                   console.log(
//                     'Response preview (first 100 chars):',
//                     responseText.substring(0, 100),
//                   );

//                   // Try to find the position of the error if it's a syntax error
//                   if (
//                     parseError instanceof SyntaxError &&
//                     parseError.message.includes('position')
//                   ) {
//                     const posMatch = parseError.message.match(/position (\d+)/);
//                     if (posMatch && posMatch[1]) {
//                       const errorPos = parseInt(posMatch[1], 10);
//                       const start = Math.max(0, errorPos - 20);
//                       const end = Math.min(responseText.length, errorPos + 20);
//                       console.log(
//                         `Characters around error position ${errorPos}:`,
//                         JSON.stringify(responseText.substring(start, end)),
//                       );

//                       // Try to fix common JSON parsing issues
//                       try {
//                         // Some APIs return JSONP or have extra characters before valid JSON
//                         // Try to find the start of a valid JSON object
//                         const jsonStart = responseText.indexOf('{');
//                         const jsonEnd = responseText.lastIndexOf('}');

//                         if (jsonStart >= 0 && jsonEnd > jsonStart) {
//                           const potentialJson = responseText.substring(
//                             jsonStart,
//                             jsonEnd + 1,
//                           );
//                           try {
//                             const fixedJson = JSON.parse(potentialJson);
//                             console.log(
//                               'Successfully parsed JSON after fixing. Found valid JSON object.',
//                             );

//                             // If we successfully parsed the JSON, check if it has the data we need
//                             if (
//                               fixedJson.data?.ad_library_main
//                                 ?.search_results_connection?.edges
//                             ) {
//                               const edges =
//                                 fixedJson.data.ad_library_main
//                                   .search_results_connection.edges;

//                               for (const edge of edges) {
//                                 if (
//                                   edge.node?.collated_results &&
//                                   Array.isArray(edge.node.collated_results)
//                                 ) {
//                                   allAdNodes.push(
//                                     ...edge.node.collated_results,
//                                   );
//                                   console.log(
//                                     `Total ads collected after fixing JSON: ${allAdNodes.length}`,
//                                   );
//                                 }
//                               }
//                             }
//                           } catch (e) {
//                             console.log(
//                               'Failed to parse JSON even after attempting to fix it.',
//                             );
//                           }
//                         }
//                       } catch (fixError) {
//                         console.error(
//                           'Error while trying to fix JSON:',
//                           fixError,
//                         );
//                       }
//                     }
//                   }
//                 }
//               }
//             } catch (innerError) {
//               console.error('Error processing ad data:', innerError);
//             }
//           }
//         } catch (responseError) {
//           console.error('Error processing response:', responseError);
//         }
//       }
//     });

//     // Function to scroll the page
//     const scrollPage = async () => {
//       console.log('Scrolling page to load more ads...');

//       // Continue scrolling until we have 200 ads or reach the bottom of the page
//       let scrollCount = 0;
//       const maxScrolls = 100; // Limit the number of scrolls to prevent infinite loops

//       while (allAdNodes.length < 200 && scrollCount < maxScrolls) {
//         scrollCount++;

//         // Scroll down
//         await page.evaluate(() => {
//           window.scrollBy(0, 800);
//         });

//         // Wait for network to be idle
//         await new Promise((resolve) => setTimeout(resolve, 2000));

//         // Check if we've reached the bottom of the page
//         const isAtBottom = await page.evaluate(() => {
//           return (
//             window.innerHeight + window.scrollY >= document.body.scrollHeight
//           );
//         });

//         if (isAtBottom) {
//           console.log('Reached bottom of page');
//           // If we're at the bottom but don't have enough ads, wait a bit and try again
//           if (allAdNodes.length < 200) {
//             await new Promise((resolve) => setTimeout(resolve, 5000));

//             // Check again if we're still at the bottom
//             const stillAtBottom = await page.evaluate(() => {
//               return (
//                 window.innerHeight + window.scrollY >=
//                 document.body.scrollHeight
//               );
//             });

//             if (stillAtBottom) {
//               console.log(
//                 `Could only collect ${allAdNodes.length} ads. Saving results...`,
//               );
//               await saveResults(allAdNodes, q);
//               break;
//             }
//           }
//         }

//         // Save intermediate results every 50 ads as a backup
//         if (allAdNodes.length > 0 && allAdNodes.length % 50 === 0) {
//           console.log(
//             `Saving intermediate results with ${allAdNodes.length} ads...`,
//           );
//           await saveResults(
//             allAdNodes,
//             `${q}_intermediate_${allAdNodes.length}`,
//           );
//         }
//       }

//       // If we've reached the maximum number of scrolls, save what we have
//       if (scrollCount >= maxScrolls && allAdNodes.length > 0) {
//         console.log(
//           `Reached maximum scroll limit. Saving ${allAdNodes.length} ads...`,
//         );
//         await saveResults(allAdNodes, q);
//       }
//     };

//     // Start scrolling the page
//     await scrollPage();
//   } catch (error) {
//     console.error('Error during scraping:', error);

//     // Try to save any collected ads before exiting
//     if (typeof allAdNodes !== 'undefined' && allAdNodes.length > 0) {
//       console.log(`Saving ${allAdNodes.length} ads collected before error...`);
//       try {
//         await saveResults(allAdNodes, q);
//       } catch (saveError) {
//         console.error('Error saving results:', saveError);
//       }
//     }
//   } finally {
//     // Make sure to close the browser
//     await browser.close();
//     console.log('Browser closed');
//   }
// }

// /**
//  * Save the collected ad data to a JSON file
//  */
// async function saveResults(adNodes: FacebookAdNode[], query: string) {
//   // Create a timestamp for the filename
//   const now = new Date();
//   const pad = (num: number) => String(num).padStart(2, '0');

//   const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}-${String(now.getMilliseconds()).padStart(3, '0')}`;
//   const filename = `dataset_facebook-ads-library_${query}_${timestamp}.json`;

//   // Ensure the data directory exists
//   const dataDir = path.join(process.cwd(), 'data');
//   if (!fs.existsSync(dataDir)) {
//     fs.mkdirSync(dataDir, { recursive: true });
//   }

//   // Write the data to a file
//   const filePath = path.join(dataDir, filename);
//   fs.writeFileSync(filePath, JSON.stringify(adNodes, null, 2));

//   console.log(`Saved ${adNodes.length} ads to ${filePath}`);
//   return filePath;
// }

// // Run the scraper
// runFacebookScraper({
//   country: '',
//   activeStatus: 'active',
//   ad_type: 'all',
//   is_targeted_country: false,
//   media_type: 'all',
//   q: 'poop',
//   search_type: 'keyword_unordered',
// }).catch((error: unknown) => {
//   console.error('Unhandled error in runFacebookScraper:', error);
//   process.exit(1);
// });
