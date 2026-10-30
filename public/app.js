const form = document.getElementById('generatorForm');
const topicInput = document.getElementById('topic');
const topicCount = document.getElementById('topicCount');
const typeSelect = document.getElementById('documentType');
const lengthSelect = document.getElementById('length');
const researchToggle = document.getElementById('includeResearch');
const generateButton = document.getElementById('generateButton');
const buttonText = document.getElementById('buttonText');
const toast = document.getElementById('toast');
const overlay = document.getElementById('workingOverlay');
const workingTitle = document.getElementById('workingTitle');
const workingMessage = document.getElementById('workingMessage');
const audienceSelect = document.getElementById('audience');
const toneSelect = document.getElementById('tone');
let toastTimer;
function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 6500);
}

topicInput.addEventListener('input', () => {
  topicCount.textContent = `${topicInput.value.length} / 500`;
});

function setWorking(isWorking, step = 'writing') {
  generateButton.disabled = isWorking;
  buttonText.textContent = isWorking ? 'Generating your PDF…' : 'Generate PDF';
  overlay.classList.toggle('show', isWorking);
  overlay.setAttribute('aria-hidden', String(!isWorking));
  if (step === 'research') {
    workingTitle.textContent = 'Researching your topic';
    workingMessage.textContent = 'Finding useful sources before the document is written.';
  } else if (step === 'format') {
    workingTitle.textContent = 'Formatting your PDF';
    workingMessage.textContent = 'Laying out the cover, contents, sections and references.';
  } else {
    workingTitle.textContent = 'Crafting your document';
    workingMessage.textContent = 'Writing sections and preparing the PDF layout.';
  }
}

function getFilename(response) {
  const header = response.headers.get('content-disposition') || '';
  const match = header.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : 'generated-document.pdf';
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestGoogleSources(topic) {
  const deadline = Date.now() + 12000;
  let element = null;
  while (Date.now() < deadline) {
    try {
      element = window.google?.search?.cse?.element?.getElement?.('pdfresearch') || null;
    } catch { element = null; }
    if (element && typeof element.execute === 'function') break;
    await wait(250);
  }
  if (!element) return { sources: [], status: 'unavailable' };

  return new Promise((resolve) => {
    const previous = window.__pdfStudioGooglePending;
    if (previous?.timer) clearTimeout(previous.timer);
    if (previous?.resolve) previous.resolve({ sources: [], status: 'unavailable' });
    const pending = {
      query: topic,
      resolve,
      timer: setTimeout(() => {
        if (window.__pdfStudioGooglePending === pending) window.__pdfStudioGooglePending = null;
        resolve({ sources: [], status: 'unavailable' });
      }, 15000)
    };
    window.__pdfStudioGooglePending = pending;
    try {
      element.execute(topic);
    } catch {
      clearTimeout(pending.timer);
      if (window.__pdfStudioGooglePending === pending) window.__pdfStudioGooglePending = null;
      resolve({ sources: [], status: 'unavailable' });
    }
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const topic = topicInput.value.trim();
  if (!topic) {
    topicInput.focus();
    showToast('Enter a topic first.', true);
    return;
  }
  setWorking(true, researchToggle.checked ? 'research' : 'writing');
  try {
    let googleResearch = { sources: [], status: 'disabled' };
    if (researchToggle.checked) {
      googleResearch = await requestGoogleSources(topic);
      if (googleResearch.status === 'unavailable') {
        showToast('Google search could not be reached. Check your CSE ID and network. The PDF will still be generated without live sources.', false);
      } else if (googleResearch.status === 'empty') {
        showToast('Google returned no matching sources. The PDF will still be generated without live citations.', false);
      }
      setWorking(true, 'writing');
    }
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        documentType: typeSelect.value,
        length: lengthSelect.value,
        audience: audienceSelect.value,
        tone: toneSelect.value,
        includeResearch: researchToggle.checked,
        googleSources: googleResearch.sources,
        googleResearchStatus: googleResearch.status
      })
    });
    if (!response.ok) {
      let message = `Generation failed (HTTP ${response.status}).`;
      try { const data = await response.json(); message = data.error || message; } catch {}
      throw new Error(message);
    }
    setWorking(true, 'format');
    const blob = await response.blob();
    if (!blob.size) throw new Error('The server returned an empty PDF. Please retry.');
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = getFilename(response);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    const rawTitle = response.headers.get('x-document-title');
    const title = rawTitle ? decodeURIComponent(rawTitle) : 'Your PDF';
    const researchStatus = response.headers.get('x-research-status');
    if (researchToggle.checked && researchStatus === 'unavailable') {
      showToast(`${title} is ready. Google search could not be reached, so live sources were not added.`, false);
    } else if (researchToggle.checked && researchStatus === 'empty') {
      showToast(`${title} is ready. Google returned no usable sources for this query.`, false);
    } else {
      showToast(`${title} has been generated and downloaded.`, false);
    }
  } catch (error) {
    showToast(error.message || 'Something went wrong. Please try again.', true);
  } finally {
    setWorking(false);
  }
});

topicCount.textContent = `${topicInput.value.length} / 500`;
