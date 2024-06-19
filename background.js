const sidebarUrl = new URL(browser.runtime.getURL("sidebar/sidebar.html"));

browser.webRequest.onBeforeSendHeaders.addListener((details) => {
  console.log(details.originUrl, details.requestHeaders);
}, {urls: ["https://tasks.google.com/*"]}, ["blocking", "requestHeaders"]);

browser.webRequest.onHeadersReceived.addListener((details) => {
  const rootFrameUrl = details.frameAncestors[0]?.url || "";
  if (rootFrameUrl !== sidebarUrl.href) { return }
  details.responseHeaders
  for (let header of details.responseHeaders) {
    switch (header.name) {
      case 'x-frame-options':
        handleXFrameOptions(header);
        break;

      case 'content-security-policy':
        handleCSP(header);
        break;
    }
  }
  return details;
}, {urls: ["https://tasks.google.com/*"]}, ["blocking", "responseHeaders"]);

// At the time this was written (2023-10-05) MDN indicated that X-Frame-Options
// headers using "ALLOW-FROM" were deprecated and could be safely replaced with
// the "frame-ancestors" CPS directive.
// 
// So, this is effectively pointless, but it's late and I've already done the
// work, so here it is. Besides, it's just 1 line. Right?
function handleXFrameOptions(header) {
  header.value += ` ${sidebarUrl.origin}`
};

const cspPolicyDelimiter = /\s*,\s*/g;
const cspDirectiveDelimiter = /\s*;\s*/g; 

function handleCSP(header) {
  // The value of `header` is what the CSP spec refers to as a [serialized CSP
  // list][1]. Basically, it's a bunch of CSPs combined together into a single
  // string. In order to ensure that we properly handle both current way Tasks
  // set's it's CSP and potential future variations, we decompose the CSP list
  // into it's constituent policies and directives, modify the specific
  // directives as desired, then recombine it back into a serialized CSP list.
  //
  // [1]: https://www.w3.org/TR/CSP3/#serialized-csp-list
  const sourceCSP = header.value;
  
  const policies = sourceCSP.split(cspPolicyDelimiter);
  const policyStrings = [];
  for (let i = 0; i < policies.length; i++) {
    const policy = policies[i];
    
    const directives = policy.split(cspDirectiveDelimiter);
    for (let j = 0; j < directives.length; j++) {
      const directive = directives[j];

      // DIRECTIVE MODIFICATIONS - START
      
      if (directive.startsWith('frame-ancestors')) {
        directives[j] += ` ${sidebarUrl.origin}`;
      }
      
      // DIRECTIVE MODIFICATIONS - END

    }
    const directiveStrings = directives.join(";");
    policyStrings.push(directiveStrings);
  }
  
  // Update the CSP "header" with combined values.
  header.value = policyStrings.join(",");
};

// browser.runtime.onStartup.addListener(() => {
//   let extUrl = browser.runtime.getURL("");  
//   browser.declarativeNetRequest.updateDynamicRules({
//     removeRuleIds: [1],
//     addRules: [
//       {
//         id: 1,
//         condition: {
//           initiatorDomains: [extUrl.hostname],
//           requestDomains: ["tasks.google.com"]
//         },
//         action: {
//           type: "modifyHeaders",
//           requestHeaders: [{
//             header: "cookie",
//             operation: "remove"
//           }]
//         }
//       }
//     ]
//   });
// });
