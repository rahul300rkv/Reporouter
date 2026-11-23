/* GitDiagram advanced viewer controls. No new provider calls. */
(() => {
  "use strict";
  const root = document.querySelector('[data-explorer-pane="gitdiagram"]');
  const graphic = document.getElementById("gitdiagram-graphic");
  const source = document.getElementById("gitdiagram-source");
  const toolbar = root?.querySelector(".gitdiagram-toolbar");
  if (!root || !graphic || !source || !toolbar) return;

  const actions = [
    ["zoom-in", "Zoom +", "Zoom in"],
    ["zoom-out", "Zoom −", "Zoom out"],
    ["fit", "Fit", "Fit diagram to available width"],
    ["fullscreen", "Fullscreen", "Toggle fullscreen diagram"],
    ["png", "PNG", "Export diagram as PNG"],
    ["svg", "SVG", "Export diagram as SVG"],
    ["mermaid", "Download .mmd", "Download Mermaid source"],
    ["readme", "Copy README", "Copy Mermaid README snippet"]
  ];
  const buttons = {};
  const group = document.createElement("div");
  group.className = "rr-diagram-actions";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Diagram navigation and export");
  actions.forEach(([key, label, title]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.dataset.diagramAction = key;
    button.disabled = true;
    group.append(button);
    buttons[key] = button;
  });
  toolbar.append(group);

  const status = document.getElementById("gitdiagram-status");
  let svg = null, zoom = 1, baseline = 0, dragging = null, seenRepo = "";
  const repoFromLink = () => {
    const url = document.getElementById("gitdiagram-external")?.href || "";
    try {
      const u = new URL(url);
      if (u.hostname !== "gitdiagram.com") return "";
      return u.pathname.replace(/^\/|\/$/g, "");
    } catch { return ""; }
  };
  const notify = (message, error = false) => {
    if (!status) return;
    status.textContent = message;
    status.dataset.error = String(error);
  };
  const filename = suffix => {
    const slug = (seenRepo || repoFromLink() || "architecture")
      .replace(/[^a-z0-9._-]+/gi, "-").slice(0, 100);
    return slug + suffix;
  };
  const diagram = () => graphic.querySelector("svg");
  const diagramText = () => {
    const s = source.textContent || "";
    // The existing viewer stores Mermaid alone when a diagram is available.
    return /^\s*(?:flowchart|graph)\s+(?:TD|TB|LR|RL|BT)\b/i.test(s) ? s.trim() : "";
  };
  const setAvailable = () => {
    const view = Boolean(diagram());
    const text = Boolean(diagramText());
    for (const key of ["zoom-in","zoom-out","fit","fullscreen","png","svg"]) buttons[key].disabled = !view;
    for (const key of ["mermaid","readme"]) buttons[key].disabled = !text;
  };
  const dimensions = el => {
    const vb = el.viewBox?.baseVal;
    let w = vb?.width || Number(el.getAttribute("width")) || 1000;
    let h = vb?.height || Number(el.getAttribute("height")) || 600;
    return {w: Math.max(1,w), h: Math.max(1,h)};
  };
  const applyZoom = next => {
    if (!svg || !svg.isConnected) return;
    zoom = Math.min(4, Math.max(.25, next));
    svg.style.setProperty("width", Math.round(baseline * zoom) + "px", "important");
    svg.style.setProperty("min-width", "0", "important");
    svg.style.setProperty("max-width", "none", "important");
    svg.style.setProperty("height", "auto", "important");
    buttons["zoom-in"].disabled = zoom >= 4;
    buttons["zoom-out"].disabled = zoom <= .25;
  };
  const fit = () => {
    svg = diagram();
    if (!svg) return;
    const {w} = dimensions(svg);
    const available = Math.max(260, graphic.clientWidth - 38);
    baseline = Math.max(260, Math.min(w, available));
    applyZoom(1);
    graphic.scrollLeft = 0;
    graphic.scrollTop = 0;
  };
  const reset = () => {
    svg = null; zoom = 1; baseline = 0; dragging = null;
    seenRepo = repoFromLink();
    setAvailable();
  };

  const saveBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  function serializedSvg() {
    const node = diagram();
    if (!node) throw Error("Load an architecture diagram first.");
    const clone = node.cloneNode(true);
    clone.removeAttribute("style");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.querySelectorAll("script,foreignObject,iframe,object,embed").forEach(n => n.remove());
    clone.querySelectorAll("*").forEach(n => {
      for (const a of Array.from(n.attributes)) {
        if (/^on/i.test(a.name) || (/^(?:href|xlink:href)$/i.test(a.name) && !a.value.startsWith("#"))) n.removeAttribute(a.name);
      }
    });
    const {w,h} = dimensions(node);
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", "0 0 " + w + " " + h);
    return {xml: new XMLSerializer().serializeToString(clone), w, h};
  }
  async function downloadPng() {
    const {xml,w,h} = serializedSvg();
    const max = 4096;
    const ratio = Math.min(2, max / Math.max(w,h));
    const width = Math.max(1, Math.round(w * ratio));
    const height = Math.max(1, Math.round(h * ratio));
    const url = URL.createObjectURL(new Blob([xml], {type:"image/svg+xml;charset=utf-8"}));
    try {
      const image = new Image();
      await new Promise((resolve,reject) => {
        image.onload = resolve;
        image.onerror = () => reject(Error("Unable to rasterize SVG. Use SVG export instead."));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("Canvas is unavailable.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0,0,width,height);
      ctx.drawImage(image,0,0,width,height);
      const blob = await new Promise((resolve,reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(Error("PNG export is unavailable.")), "image/png"));
      saveBlob(blob,filename(".png"));
    } finally { URL.revokeObjectURL(url); }
  }
  const copyText = async text => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.style.position = "fixed";
      field.style.left = "-10000px";
      document.body.append(field);
      field.select();
      const ok = document.execCommand("copy");
      field.remove();
      if (!ok) throw Error("Clipboard not available. Select the source text to copy.");
    }
  };
  group.addEventListener("click", async e => {
    const button = e.target.closest("button[data-diagram-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.diagramAction;
    try {
      switch(action) {
        case "zoom-in": applyZoom(zoom * 1.25); break;
        case "zoom-out": applyZoom(zoom / 1.25); break;
        case "fit": fit(); break;
        case "fullscreen":
          if (document.fullscreenElement === root) await document.exitFullscreen();
          else { if (!root.requestFullscreen) throw Error("Fullscreen is not supported here."); await root.requestFullscreen(); }
          break;
        case "svg": {
          const {xml} = serializedSvg();
          saveBlob(new Blob([xml],{type:"image/svg+xml;charset=utf-8"}),filename(".svg"));
          notify("SVG downloaded.");
          break;
        }
        case "png": await downloadPng(); notify("PNG downloaded."); break;
        case "mermaid": {
          const text = diagramText();
          if (!text) throw Error("Mermaid source unavailable.");
          saveBlob(new Blob([text+"\n"],{type:"text/plain;charset=utf-8"}),filename(".mmd"));
          notify("Mermaid source downloaded."); break;
        }
        case "readme": {
          const text = diagramText();
          if (!text) throw Error("Mermaid source unavailable.");
          await copyText("## Repository architecture\n\n" + "\`\`\`mermaid\n" + text + "\n\`\`\`\n\n" +
            "Generated diagram: https://gitdiagram.com/" + (seenRepo || repoFromLink()) + "\n");
          notify("README Mermaid block copied."); break;
        }
      }
    } catch(err) { notify(err?.message || "Diagram action failed.", true); }
  });

  // Drag to pan when the diagram is bigger than the viewport.
  graphic.addEventListener("pointerdown",e => {
    if (!diagram() || e.button !== 0 || e.target.closest("a,button")) return;
    dragging = {x:e.clientX,y:e.clientY,left:graphic.scrollLeft,top:graphic.scrollTop};
    graphic.setPointerCapture?.(e.pointerId);
    graphic.classList.add("rr-diagram-dragging");
  });
  graphic.addEventListener("pointermove",e => {
    if (!dragging) return;
    graphic.scrollLeft = dragging.left - (e.clientX - dragging.x);
    graphic.scrollTop = dragging.top - (e.clientY - dragging.y);
  });
  const endDrag = () => {dragging=null;graphic.classList.remove("rr-diagram-dragging");};
  graphic.addEventListener("pointerup",endDrag);
  graphic.addEventListener("pointercancel",endDrag);
  // Native scrolling remains available on touch and trackpads.
  graphic.addEventListener("wheel",e => {
    if (!e.ctrlKey || !diagram()) return;
    e.preventDefault();
    applyZoom(zoom * (e.deltaY < 0 ? 1.1 : 1/1.1));
  },{passive:false});

  const observer = new MutationObserver(() => {
    const next = diagram();
    if (next !== svg) {
      if (next) {seenRepo=repoFromLink();fit();}
      else reset();
      setAvailable();
    }
  });
  observer.observe(graphic,{childList:true});
  window.addEventListener("reporouter:opened",reset);
  window.addEventListener("reporouter:closed",reset);
  document.addEventListener("fullscreenchange",() => {
    buttons.fullscreen.textContent = document.fullscreenElement===root ? "Exit fullscreen" : "Fullscreen";
    if (diagram()) fit();
  });
  window.addEventListener("resize", () => { if (diagram() && zoom===1) fit(); });
  setAvailable();
})();