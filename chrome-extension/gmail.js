// Isolated content script. No inbox extraction, arbitrary selectors, or page instructions.
(() => {
  const pause = (question, notReady = false) => ({ success: false, needsClarification: true, question, notReady });
  function senderAddress() {
    const account = document.querySelector('a[href*="accounts.google.com/SignOutOptions"]');
    const emails = (account?.getAttribute('aria-label') || '').match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [];
    return emails.length === 1 ? emails[0] : null;
  }
  function inspect(mail, sender) {
    if (senderAddress() !== sender) return pause('The Gmail account could not be verified or changed. Please check which account is signed in.');
    const subjects = [...document.querySelectorAll('input[name="subjectbox"]')];
    if (subjects.length !== 1) return pause('Gmail must have exactly one visible compose draft. Please check the compose window.', subjects.length === 0);
    const subject = subjects[0];
    const root = subject.closest('.M9') || subject.closest('[role="dialog"]');
    if (!root) return pause('Gmail changed its compose layout. Please finish this draft manually.');
    const bodies = root.querySelectorAll('[contenteditable="true"][g_editable="true"]');
    if (bodies.length !== 1) return pause('The Gmail message body could not be identified safely.', bodies.length === 0);
    const body = bodies[0];
    const recipients = [...root.querySelectorAll('[email]')].map((node) => node.getAttribute('email'));
    const inputs = [...root.querySelectorAll('input[name="to"], textarea[name="to"]')].map((node) => node.value.trim()).filter(Boolean);
    const addresses = [...new Set([...recipients, ...inputs])];
    const hasOtherRecipients = [...root.querySelectorAll('input[name="cc"], textarea[name="cc"], input[name="bcc"], textarea[name="bcc"]')].some((node) => node.value.trim());
    if (hasOtherRecipients || recipients.length > 1 || addresses.length !== 1 || addresses[0] !== mail.to) return pause('The recipient or CC/BCC fields differ from the requested draft. Please inspect them.');
    if (root.querySelector('.aQH .aZo, .aQH .dL') || body.querySelector('img')) return pause('Attachments or inline images are present. This bridge supports plain-text messages only.');
    const text = body.innerText.replace(/\r\n?/g, '\n');
    if (subject.value !== mail.subject || text !== mail.body) return pause('The subject or message changed (possibly a signature). Please review the Gmail draft. Sending permission has not been used.');
    // Refuse an explicit From alias unless it matches the verified signed-in sender.
    const fromControls = [...root.querySelectorAll('[name="from"], [aria-label^="From"], .az2')];
    for (const from of fromControls) {
      const value = String(from.value || from.textContent || from.getAttribute('aria-label'));
      const emails = value.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [];
      if (emails.length !== 1 || emails[0] !== sender) return pause('The compose From address could not be verified as the signed-in sender. Please inspect it and send manually.');
    }
    return { success: true, root, to: mail.to, subject: mail.subject, body: text, sender };
  }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    (async () => {
      if (message.type === 'account') {
        const sender = senderAddress();
        return sender ? { success: true, sender } : pause('Please sign in to Gmail and ensure the account email is visible in the Google account button.');
      }
      if (!['verify', 'send'].includes(message.type)) return pause('Unsupported Gmail action.');
      const result = inspect(message.mail, message.sender);
      if (!result.success) return result;
      const { root, ...verified } = result;
      if (message.type === 'verify') return verified;
      if (message.expires < Date.now()) return pause('Sending approval expired. Nothing sent.');
      const buttons = [...root.querySelectorAll('[role="button"]')].filter((node) => {
        const label = (node.getAttribute('aria-label') || node.textContent || '').replace(/[\u202a-\u202e]/g, '').trim();
        return /^Send(?:\s*\(|$)/.test(label) && node.getAttribute('aria-disabled') !== 'true';
      });
      if (buttons.length !== 1) return pause('The Send button could not be identified safely. This version requires Gmail’s English interface; please send manually.');
      buttons[0].click(); // Only reached via server's consumed, exact-draft human approval.
      for (let count = 0; count < 50; count++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const alerts = [...document.querySelectorAll('[role="alert"], .bAq')];
        if (!root.isConnected && alerts.some((node) => /\bMessage sent\b/.test(node.textContent || ''))) return { success: true, message: 'Gmail confirmed: Message sent.' };
      }
      return pause('Gmail did not confirm sending. Check Sent before doing anything else; Sameera will not retry.');
    })().then(respond).catch(() => respond(pause('Gmail could not be verified. Please inspect the page.')));
    return true;
  });
})();
