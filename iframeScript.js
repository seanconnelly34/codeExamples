/**This script gets injected into the stencil template iframes on the edit page and
 * is not processed as part of the app webpack build. This is why the file is self
 * contained and does not use any imports. Due to the way create-react-app locks down
 * the webpack settings, we were not able to modularize this file.
 */
const domLoaded = () => {
  // variables
  const __parentWindow = window.parent;
  const __parentOrigin = window.origin;
  const editableElements = document.querySelectorAll(
    "[contenteditable]:not(.custom)"
  );
  const customElements = document.getElementsByClassName("custom");
  const customTextElements = document.getElementsByClassName("custom-text");
  const moveableElements = document.querySelectorAll("[data-customizable]");
  const guidelineElements = Array.from(moveableElements).filter(
    (node) => !node.dataset.customizable.includes("text")
  );
  let imageElements = Array.from(moveableElements).filter(
    (node) => node.nodeName === "IMG" && node.id !== "propertyQrCode"
  );
  let newImgSrc = "";
  let variableName = "";
  let imgSources = imageElements.map((img) => ({ id: img.id, src: img.src }));
  let iframeWidth = document.body.offsetWidth;
  let iframeHeight = document.body.offsetHeight;
  // store element location and mousedown timestamp to determine if user moved on click event
  let elementLocation = {};
  let mousedownTime = 0;
  let lastClicked = null;
  // store the initial zoom for moveable
  let initialZoom = 1;
  // delayed tracking bit for first click into a page (page-focus), reset at page-blur
  let hasAnyClick = false;

  // make the custom text elements editable
  Array.from(customTextElements).forEach(
    (node) => (node.contentEditable = true)
  );

  const IMAGE_MASK_CONTAINER_CLASS = "image-mask";
  const IMAGE_MASK_CLICK_TARGET_CLASS = "image-mask-click-target";
  const MASKED_IMAGE_CLASS = "masked-image-activated";

  function activateCropMaskBehavior(image) {
    const parent = image.parentNode;

    if (!parent.classList.contains(IMAGE_MASK_CONTAINER_CLASS)) {
      // parent is not a mask, skip (this implies this particular image should NOT be masked/cropped, like a logo)
      return;
    }

    if (!image.id) {
      return;
    }

    // if image already has the class, then it's been activated.
    if (!image.classList.contains(MASKED_IMAGE_CLASS)) {
      const iStyles = window.getComputedStyle(image);

      // ensure the image has some sort of z-index
      if (!iStyles.zIndex || iStyles.zIndex < 1) {
        image.style.zIndex = 1;
      }

      image.classList.add(MASKED_IMAGE_CLASS);
      addMaskClickTarget(image);
    }
  }

  imageElements.forEach((image) => {
    activateCropMaskBehavior(image);
  });

  // functions
  const getAllEditableFieldsAsMergeVariables = function () {
    let mergeVariables = [];
    Array.prototype.forEach.call(editableElements, function (el) {
      const name = el.id;
      const page = `${window.name}`;
      const value = el.nodeName === "IMG" ? el.src : el.innerHTML;
      mergeVariables.push({ name, page, value });
    });

    return mergeVariables;
  };

  const setAllEditableFieldsAsMergeVariables = function (mergeVariables) {
    mergeVariables.forEach(function (item) {
      const name = item.name;
      const value = item.value;
      const el = document.getElementById(name);
      if (!el) return;
      el.innerHTML = value;
    });
  };

  const isMoveable = (element) =>
    element.dataset?.customizable?.includes("move") ||
    element.classList.contains(MASKED_IMAGE_CLASS) ||
    element.classList.contains(IMAGE_MASK_CONTAINER_CLASS);

  const isResizable = (element) =>
    element.dataset?.customizable?.includes("resize") ||
    element.classList.contains(MASKED_IMAGE_CLASS) ||
    element.classList.contains(IMAGE_MASK_CONTAINER_CLASS);

  const sendPostMessage = (data) => {
    __parentWindow.postMessage(data, __parentOrigin);
  };

  const handleImgDrop = ({ target }, name) => {
    // for some reason we don't know what the new image should be, don't change
    if (!newImgSrc) return;
    target.src = newImgSrc;

    if (target.classList.contains("custom")) {
      sendPostMessage({
        type: "updateCustomImage",
        id: target.id,
        src: newImgSrc,
        variableName,
      });
    } else {
      sendPostMessage({
        type: "updateField",
        name,
        value: newImgSrc,
        resetImages: "true",
        page: window.name,
      });
    }

    let imgIndex = imgSources.findIndex((img) => img.id === target.id);
    if (imgIndex !== -1) imgSources[imgIndex].src = newImgSrc;
    target.style.opacity = "";
    target.style.border = "";
    resetEditing();
  };

  const handleDragEnter = ({ target }) => {
    target.style.opacity = 1;
    if (newImgSrc) target.src = newImgSrc;
    target.style.border = "solid 2px green";
  };

  const handleDragLeave = ({ target }) => {
    target.style.opacity = "";
    target.style.border = "";
    target.src = imgSources.find((img) => img.id === target.id).src;
  };

  const setImagesSelectable = (isSelectable) => {
    imageElements.forEach((img) => {
      if (isSelectable) {
        img.classList.add("can-select");
      } else {
        img.classList.remove("can-select");
      }
    });
  };

  const updateSafeZoneVisibility = (hide) => {
    const safeZoneElem = document.getElementById("safe-zone");
    const safeZoneText = document.getElementById("cut-text");
    const foldLine = document.getElementById("fold-line");
    const foldLineText = document.getElementById("fold-line-text");

    if (safeZoneElem === null || safeZoneText === null) return;
    safeZoneElem.style.display = hide ? "none" : "initial";
    safeZoneText.style.display = hide ? "none" : "initial";
    foldLine.style.display = hide ? "none" : "initial";
    foldLineText.style.display = hide ? "none" : "initial";
  };

  const hideCallToAction = (hide) => {
    let ctaElem =
      document.getElementById("_cta") || document.getElementById("cta");
    if (ctaElem === null) return;
    ctaElem.style.display = hide ? "none" : "initial";
  };

  const insertCallToAction = (cta) => {
    let ctaElem = document.getElementById("_cta");
    if (ctaElem === null) return;
    ctaElem.innerHTML = cta;
  };

  const updateAllFields = (newData) => {
    newData.forEach((field) => {
      let node = document.getElementById(field.name);
      if (node?.nodeName === "IMG") node.src = field.value;
      else if (node) node.innerHTML = field.value;
    });
  };

  const removeEditing = () => {
    window.getSelection().removeAllRanges();
    document.activeElement.blur();
    document.querySelectorAll("[data-customizable]").forEach((el) => {
      el.classList.remove("editing");
      el.classList.remove("can-select");
    });
    document
      .querySelectorAll(`.${IMAGE_MASK_CONTAINER_CLASS}`)
      .forEach((el) => {
        el.style.border = "";
      });
    removeMaskGhost();
  };

  /** Set the selected element and edit mode in live editor
   * @param {Element} target - The element to be set
   * @param {string} [mode=move] - The editor mode "move" or "text"
   */
  const setSelectedElement = (target, mode = "move") => {
    if (mode === "move") removeEditing();
    editingElement = target;

    if (
      !editingElement?.dataset?.customizable &&
      !editingElement.classList.contains(IMAGE_MASK_CONTAINER_CLASS)
    ) {
      return;
    }

    const compStyles = window.getComputedStyle(editingElement);
    const canResize = !!isResizable(target);

    // handle image select
    const isImage =
      (target.nodeName === "IMG" ||
        target.classList.contains(IMAGE_MASK_CONTAINER_CLASS)) &&
      isMoveable(target);
    const isShape = editingElement?.dataset?.customizable?.includes("shape");

    if (isImage || isShape) {
      setMoveableTarget(target);
      moveable.resizable = canResize;
      let isMaskedImage = false;

      if (target.classList.contains(MASKED_IMAGE_CLASS)) {
        target.parentNode.style.border = "1px solid #FB02FF";
        isMaskedImage = true;
      } else if (target.classList.contains(IMAGE_MASK_CONTAINER_CLASS)) {
        target.style.border = "1px solid #FB02FF";
        isMaskedImage = true;
      }

      const currentStyles = {
        opacity: compStyles.opacity,
        objectFit: compStyles.objectFit,
        objectPosition: compStyles.objectPosition,
        fill: compStyles.fill,
        stroke: compStyles.stroke,
        strokeWidth: parseInt(compStyles.strokeWidth),
        width: compStyles.width,
        height: compStyles.height,
        zIndex: Number.isNaN(parseInt(compStyles.zIndex))
          ? 0
          : parseInt(compStyles.zIndex),
      };

      sendPostMessage({
        type: "setEditing",
        id: editingElement.id,
        currentStyles,
        editType: isImage ? "image" : "shape",
        editMode: "move",
        canResize,
        isMaskedImage,
      });

      isMaskedImage ? showMaskGhost() : removeMaskGhost();

      return;
    }

    removeMaskGhost();

    // handle text select
    if (editingElement?.dataset?.customizable?.includes("text")) {
      if (mode === "text" && editingElement.contentEditable) {
        // set element to text mode
        if (document.activeElement !== editingElement) {
          editingElement.focus();
          // set caret to end rather than front
          document.execCommand("selectAll", false, null);
          document.getSelection().collapseToEnd();
        }

        setMoveableTarget(null);
        editingElement.classList.add("editing");
      } else {
        // set element to moveable mode
        editingElement.blur();
        setMoveableTarget(editingElement);
        moveable.resizable = canResize;
      }

      const [fontSize, lineHeight, letterSpacing, zIndex] = [
        { prop: "font-size", default: 16 },
        { prop: "line-height", default: undefined },
        { prop: "letter-spacing", default: 0 },
        { prop: "z-index", default: 0 },
      ].map((item) => {
        const val = parseInt(compStyles[item.prop].replace("px", ""));

        return Number.isNaN(val) ? item.default : val;
      });

      const currentStyles = {
        fontFamily: compStyles.fontFamily.replace(/"/g, ""),
        fontSize,
        lineHeight: lineHeight ?? fontSize * 1.2,
        letterSpacing,
        zIndex,
        textAlign: compStyles.textAlign,
        fontWeight: compStyles.fontWeight,
        fontStyle: compStyles.fontStyle,
        textDecoration: compStyles.textDecoration,
        textTransform: compStyles.textTransform,
        color: compStyles.color,
        opacity: compStyles.opacity,
      };

      sendPostMessage({
        type: "setEditing",
        id: editingElement.id,
        currentStyles,
        editType: "text",
        editMode: mode,
      });
    } else {
      sendPostMessage({ type: "setEditing", id: "" });
      setMoveableTarget(null);
    }
  };

  function htmlToElement(html) {
    var template = document.createElement("template");
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;

    return template.content.firstChild;
  }

  const setFieldValue = (data) => {
    const { id, value } = data;
    const el = document.getElementById(id);
    if (el?.nodeName === "IMG") el.src = value;
    else if (el.contentEditable) el.innerHTML = value;
  };

  /** When adding a custom element to the iframe this function will return a promise
   * once the element has a position of "absolute". This lets us know that the custom
   * CSS has been applied before taking further actions.
   * @param {HTMLElement} node - The node to check the CSS of
   */
  const waitForNodeCSS = (node) => {
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const nodePosition = window
          .getComputedStyle(node)
          .getPropertyValue("position");

        if (nodePosition === "absolute") {
          resolve();
          observer.disconnect();
        }
      });
      observer.observe(document.getElementById("custom-styles"), {
        childList: true,
        subtree: true,
        characterData: true,
      });
      document.body.appendChild(node);
    });
  };

  function toggleCropMode() {
    // extra toggle happening here on first selection of any element,
    // which is causing the first click on a masked image to switch to
    // focus on the container instead. we want the image to be primary.
    // delayed setting of this in findAndSet to mitigate the race
    if (!hasAnyClick) {
      return;
    }

    // don't attempt toggle if we have no target
    // (symptom of how toggle is handled) in alf-react main app,
    // useEffect emits too many events instead of just the click on the toggle icon,
    // because it is also tied to the page var being changed
    if (!moveable?.target) {
      return;
    }

    const isMaskedImage =
      moveable.target.classList.contains(MASKED_IMAGE_CLASS);
    const isImageMaskContainer = moveable.target.classList.contains(
      IMAGE_MASK_CONTAINER_CLASS
    );

    if (isMaskedImage) {
      // set moveable.target to image parent container
      setSelectedElement(moveable.target.parentNode);
    } else if (isImageMaskContainer) {
      // set moveable.target to child image
      setSelectedElement(
        moveable.target.querySelector(`.${MASKED_IMAGE_CLASS}`)
      );
    }

    if (isMaskedImage || isImageMaskContainer) showMaskGhost();
  }

  const IMAGE_MASK_GHOST_CONTAINER_CLASS = "image-mask-ghost-container";
  const MASKED_IMAGE_GHOST_ID = "masked-image-ghost";

  function showMaskGhost() {
    // TODO: make the image ghost also click-draggable like the main image is
    // may require either a second moveable instance, or a mouse-down switch of the moveable target to the ghost,
    // that also updates the main image position/transform
    console.log(
      "image mask ghost is turned off for now, it is not click-draggable yet and this can cause some UI confusion"
    );

    return;

    // eslint-disable-next-line no-unreachable
    removeMaskGhost();
    if (!moveable?.target) return;

    if (moveable.target.classList.contains(MASKED_IMAGE_CLASS)) {
      const parent = moveable.target.parentNode;
      const pStyles = window.getComputedStyle(parent);
      const box = parent.getBoundingClientRect();

      const ghostContainer = document.createElement("div");
      ghostContainer.classList.add(IMAGE_MASK_GHOST_CONTAINER_CLASS);
      ghostContainer.style.position = "absolute";
      ghostContainer.style.overflow = "visible";
      ghostContainer.style.zIndex = -100;
      ghostContainer.style.top = box.top + "px";
      ghostContainer.style.left = box.left + "px";
      ghostContainer.style.width = box.width + "px";
      ghostContainer.style.height = box.height + "px";
      ghostContainer.style.opacity = 0.3;
      ghostContainer.style.transform = pStyles.transform;
      ghostContainer.style.translate = pStyles.translate;

      const ghost = moveable.target.cloneNode();
      ghost.id = MASKED_IMAGE_GHOST_ID; // ensure no dupe IDs in the DOM
      ghostContainer.appendChild(ghost);
      document.body.appendChild(ghostContainer);
    }
  }

  function removeMaskGhost() {
    document
      .querySelectorAll(`.${IMAGE_MASK_GHOST_CONTAINER_CLASS}`)
      .forEach((el) => {
        el.remove();
      });
  }

  function updateGhost(transform, width, height) {
    const ghost = document.getElementById(MASKED_IMAGE_GHOST_ID);

    if (ghost) {
      ghost.style.transform = transform;
      if (width) ghost.style.width = width;
      if (height) ghost.style.height = height;
    }
  }

  /** Handle postMessage events from the parent window
   * @param {Event} e - The postMessage event
   */
  async function receiver(e) {
    let root = document.documentElement;
    const type = e.data?.type;

    if (Array.isArray(e.data)) {
      setAllEditableFieldsAsMergeVariables(e.data);
    } else if (e.data === "getAllEditableFieldsAsMergeVariables") {
      sendPostMessage({
        type: "setFields",
        fields: getAllEditableFieldsAsMergeVariables(),
      });
    } else if (type === "updateBrandColor") {
      root.style.setProperty("--brand-color", e.data.value);
    } else if (type === "imageSelected") {
      newImgSrc = e.data?.imgSrc;
      variableName = e.data?.variableName;
      setImagesSelectable(!!e.data?.imgSrc);
    } else if (type === "showSafeZone") {
      const { showSafeZone } = e.data;
      updateSafeZoneVisibility(showSafeZone);
    } else if (type === "hideCTA") {
      const { hideCTA } = e.data;
      hideCallToAction(hideCTA);
    } else if (type === "cta") {
      const { CTA } = e.data;
      insertCallToAction(CTA);
    } else if (type === "updateAllFields") {
      updateAllFields(e.data?.replaceFieldData);
    } else if (type === "setFieldValue") {
      setFieldValue(e.data);

      // toggle move/resize for image vs container:
    } else if (type === "toggleCropMode") {
      toggleCropMode();
    } else if (type === "customStyles") {
      let customStyles = document.getElementById("custom-styles");
      if (customStyles) customStyles.innerHTML = e.data?.fullCssString;
    } else if (type === "removeTransform") {
      const node = document.getElementById(e.data.id);
      // support reset of resize as well as other css-edits from moveable:
      node.style.transform = "";
      node.style.cssText = "";

      if (node.classList.contains(IMAGE_MASK_CONTAINER_CLASS)) {
        // reset the child image also
        const containedImage = node.querySelector(`.${MASKED_IMAGE_CLASS}`);

        if (containedImage) {
          containedImage.style.transform = "";
          containedImage.style.cssText = "";
        }
      }

      if (node.classList.contains(MASKED_IMAGE_CLASS)) {
        // reset the container also
        node.parentNode.style.transform = "";
        node.parentNode.style.cssText = "";
      }

      if (moveable.target) {
        setTimeout(() => moveable.updateTarget(), 0);
      } else {
        setSelectedElement(node);
      }
    } else if (type === "resetSelected") {
      removeEditing();
      if (moveable?.target) moveable.target = null;
    } else if (type === "addElement") {
      // want iFrame to focus so that it is possible to move the newly added element ...
      // ... without clicking on it first inside the document
      window.focus();

      const { content, id, src, isMaskedImage } = e.data;
      const newNode = htmlToElement(content);
      const maskedImageNode = newNode.querySelector("img");

      if (isMaskedImage && !maskedImageNode) {
        // something is wrong, no masked image in the pass?
        console.log(
          "ABORT something wrong adding a masked image, what did we add?",
          content,
          newNode
        );

        return;
      }

      addEditListeners(isMaskedImage ? maskedImageNode : newNode);
      addClickListeners(isMaskedImage ? maskedImageNode : newNode);
      await waitForNodeCSS(newNode);

      if (src) {
        // adding an image node
        const onLoad = () => {
          // setSelectedElement(isMaskedImage ? maskedImageNode : newNode);
          setSelectedElement(newNode);

          return (
            isMaskedImage ? maskedImageNode : newNode
          ).removeEventListener("load", onLoad);
        };

        imgSources.push({ id, src });
        (isMaskedImage ? maskedImageNode : newNode).addEventListener(
          "load",
          onLoad
        );
        imageElements.push(isMaskedImage ? maskedImageNode : newNode);

        if (isMaskedImage) {
          activateCropMaskBehavior(maskedImageNode);
        }
      } else {
        // adding a text or shape node
        moveable.elementGuidelines.push(newNode);
        setSelectedElement(newNode);
      }
    } else if (type === "resizeElement") {
      const { id, dim, value } = e.data;
      document.getElementById(id).style[dim] = value;
      moveable.updateRect();
    } else if (type === "deleteElement") {
      const { id } = e.data;
      const node = document.getElementById(id);

      if (node) {
        if (node.parentNode.classList.contains(IMAGE_MASK_CONTAINER_CLASS)) {
          node.parentNode.remove();
        } else {
          node.remove();
        }
      }

      moveable.target = null;

      // remove any image mask container as well:
      if (document.getElementById(`${id}Mask`)) {
        document.getElementById(`${id}Mask`).remove();
      }
    } else if (type === "hideElement") {
      const { id } = e.data;
      const node = document.getElementById(id);

      if (node) {
        if (node.parentNode.classList.contains(IMAGE_MASK_CONTAINER_CLASS)) {
          node.parentNode.style.visibility = "hidden";
        } else {
          node.style.visibility = "hidden";
        }
      }

      moveable.target = null;
    } else if (type === "unhideElement") {
      const { id } = e.data;
      const node = document.getElementById(id);

      if (node) {
        if (node.parentNode.classList.contains(IMAGE_MASK_CONTAINER_CLASS)) {
          node.parentNode.style.visibility = "visible";
        } else {
          node.style.visibility = "visible";
        }
      }
    } else if (type === "updateZoom") {
      const zoom = 1 / e.data.zoomValue || 1;
      initialZoom = zoom;
      if (moveable) moveable.zoom = zoom;
    } else {
      // Type not recognized. Log the message.
      console.log(JSON.stringify(e.data));
    }
  }

  function preventDefault(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function loadError(oError) {
    throw new URIError(
      "The script " + oError.target.src + " didn't load correctly."
    );
  }

  function prefixScript(url, onloadFunction) {
    var newScript = document.createElement("script");
    newScript.onerror = loadError;

    if (onloadFunction) {
      newScript.onload = onloadFunction;
    }

    document.currentScript.parentNode.insertBefore(
      newScript,
      document.currentScript
    );
    newScript.src = url;
  }

  // the element currently being edited
  let editingElement = null;

  const onScreen = (node) => {
    if (!node) return false;
    const { top, bottom, right, left } = node.getBoundingClientRect();
    const { clientWidth, clientHeight } = document.body;
    if (top < 0 || left < 0 || right > clientWidth || bottom > clientHeight)
      return false;

    return true;
  };

  const setRotateHandle = (target) => {
    const rotateHandle = document.querySelector(".moveable-rotation-control");
    if (!target || !rotateHandle) return;
    moveable.rotationPosition = "top";
    if (onScreen(rotateHandle)) return;
    moveable.rotationPosition = "bottom";
    if (onScreen(rotateHandle)) return;
    moveable.rotationPosition = "left";
    if (onScreen(rotateHandle)) return;
    moveable.rotationPosition = "right";
    if (onScreen(rotateHandle)) return;
    moveable.rotationPosition = "top-left";
    if (onScreen(rotateHandle)) return;
    moveable.rotationPosition = "top-right";
    if (onScreen(rotateHandle)) return;
    moveable.rotationPosition = "bottom-left";
    if (onScreen(rotateHandle)) return;
    moveable.rotationPosition = "bottom-right";
  };

  // add the moveable instance
  let moveable = null;

  const setMoveableTarget = (node) => {
    document
      .querySelectorAll(".moving")
      .forEach((node) => node.classList.remove("moving"));
    if (moveable) moveable.target = node;
    setRotateHandle(node);
    if (node) node.classList.add("moving");
  };

  // Add moveable library
  prefixScript(
    "//daybrush.com/moveable/release/0.24.5/dist/moveable.min.js",
    () => {
      // eslint-disable-next-line no-undef
      moveable = new Moveable(document.body, {
        draggable: true,
        rotatable: true,
        origin: false,
        throttleRotate: 1,
        snappable: true,
        snapVertical: true,
        snapHorizontal: true,
        snapElement: true,
        snapCenter: true,
        elementGuidelines: guidelineElements,
        verticalGuidelines: [
          0,
          iframeWidth * 0.2,
          iframeWidth * 0.4,
          iframeWidth * 0.5,
          iframeWidth * 0.6,
          iframeWidth * 0.8,
          iframeWidth,
        ],
        horizontalGuidelines: [
          0,
          iframeHeight * 0.2,
          iframeHeight * 0.4,
          iframeHeight * 0.5,
          iframeHeight * 0.6,
          iframeHeight * 0.8,
          iframeHeight,
        ],
        snapThreshold: 5,
        zoom: initialZoom,
      });

      moveable
        .on("drag", ({ target, transform }) => {
          target.style.transform = transform;
          updateGhost(transform);
          setRotateHandle(target);
        })
        .on("dragEnd", ({ target, lastEvent }) => {
          if (lastEvent) {
            updateGhost(lastEvent.transform);
            sendPostMessage({
              type: "updateCSS",
              id: target.id,
              newData: { transform: lastEvent.transform },
            });
          }
        })
        .on("rotate", ({ target, transform }) => {
          target.style.transform = transform;
          updateGhost(transform);
        })
        .on("rotateEnd", ({ target, lastEvent }) => {
          if (lastEvent) {
            updateGhost(lastEvent.transform);
            sendPostMessage({
              type: "updateCSS",
              id: target.id,
              newData: { transform: lastEvent.transform },
            });
          }
        })
        .on(
          "resize",
          ({ target, inputEvent, width, height, drag: { transform } }) => {
            moveable.keepRatio = inputEvent.shiftKey;
            const W = Math.max(width, 6) + "px";
            const H = Math.max(height, 6) + "px";
            target.style.width = W;
            target.style.height = H;
            target.style.transform = transform;
            updateGhost(transform, W, H);
          }
        )
        .on("resizeEnd", ({ target, lastEvent }) => {
          if (lastEvent) {
            const {
              width,
              height,
              drag: { transform },
            } = lastEvent;
            updateGhost(lastEvent.transform);
            sendPostMessage({
              type: "updateCSS",
              id: target.id,
              newData: {
                transform,
                width: width + "px",
                height: height + "px",
              },
            });

            // update input dimensions
            setSelectedElement(target, "move");
          }
        });
    }
  );

  // If the element was moved or the click lasted longer than 500ms assume the user intended a drag event
  // do not set to text edit mode in these cases
  function wasElementDragged(start, end, mouseupTime) {
    return (
      Math.abs(start.x - end.x) > 5 ||
      Math.abs(start.y - end.y) > 5 ||
      mouseupTime - mousedownTime > 500
    );
  }

  function findAndSet(e, isMaskTargetClick) {
    const { type, currentTarget } = e;

    // only run focus event if tab action (not from user click)
    if (type === "focus" && currentTarget === lastClicked) {
      lastClicked = null;

      return;
    }

    if (!hasAnyClick) setTimeout(() => (hasAnyClick = true), 1000);

    // crop/mask support
    // only pass click through if the current target parent is not the current move target
    // i.e., is not the mask (clicking the image in the mask should not select the image)
    if (type === "click" && moveable?.target) {
      if (
        currentTarget.classList.contains(MASKED_IMAGE_CLASS) &&
        (currentTarget === moveable.target ||
          currentTarget.parentNode === moveable.target)
      ) {
        return;
      } else if (
        (currentTarget.classList.contains(IMAGE_MASK_CONTAINER_CLASS) &&
          !isMaskTargetClick &&
          currentTarget === moveable.target) ||
        currentTarget.querySelector(`.${MASKED_IMAGE_CLASS}`) ===
          moveable.target
      ) {
        return;
      }
    }

    // crop/mask support
    // double-click on an image or mask (container) should toggle active element
    if (
      type === "dblclick" &&
      (currentTarget.classList.contains(IMAGE_MASK_CONTAINER_CLASS) ||
        currentTarget.classList.contains(MASKED_IMAGE_CLASS))
    ) {
      return toggleCropMode();
    }

    const isDrag = wasElementDragged(
      elementLocation,
      currentTarget.getBoundingClientRect(),
      Date.now()
    );
    const isEditing = currentTarget.classList.contains("editing");
    // determine movable vs text mode on click
    const editMode =
      (isDrag || currentTarget !== moveable?.target) && !isEditing
        ? "move"
        : "text";
    setSelectedElement(currentTarget, editMode);
    sendPostMessage({ elementClicked: true });
  }

  window.addEventListener("message", receiver, false);

  // prevent drop events on elements that are not images
  document.querySelectorAll("body :not(img)").forEach((node) => {
    node.addEventListener("drop", (e) => {
      e.preventDefault();
      resetEditing();
    });
  });

  // necessary because empty divs cannot be clicked on in the DOM, need to have something
  // easiest answer was to just clone the current active image and place behind with opacity: 0
  // this gives 100% coverage to the mask div to click on
  function addMaskClickTarget(el) {
    // ensure we don't add this element more than once per "crop session"
    if (
      !el.classList.contains(MASKED_IMAGE_CLASS) ||
      document.getElementById(`clickTarget-${el.parentNode.id}`)
    ) {
      return;
    }

    const maskClickTarget = el.cloneNode();
    maskClickTarget.style.opacity = 0;
    maskClickTarget.style.top = 0;
    maskClickTarget.style.left = 0;
    maskClickTarget.style.width = "100%";
    maskClickTarget.style.height = "100%";
    maskClickTarget.style.position = "absolute";
    maskClickTarget.style.zIndex = -1;
    maskClickTarget.id = `clickTarget-${el.parentNode.id}`;
    maskClickTarget.classList.add(IMAGE_MASK_CLICK_TARGET_CLASS);
    el.parentNode.appendChild(maskClickTarget);

    maskClickTarget.addEventListener("click", (e) => {
      findAndSet(
        { type: e.type, currentTarget: e.currentTarget.parentNode },
        true
      );
    });
    maskClickTarget.addEventListener("dblclick", (e) => {
      findAndSet(
        { type: e.type, currentTarget: e.currentTarget.parentNode },
        true
      );
    });
  }

  const addClickListeners = (el) => {
    el.addEventListener("mousedown", (e) => {
      elementLocation = e.currentTarget.getBoundingClientRect();
      mousedownTime = Date.now();
      lastClicked = e.currentTarget;
    });
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      findAndSet(event);
    });
    el.addEventListener("focus", findAndSet);
    el.addEventListener("dblclick", (event) => {
      // event.stopPropagation();
      findAndSet(event);
    });
  };

  moveableElements.forEach((el) => {
    addClickListeners(el);
  });

  const resetEditing = () => {
    removeEditing();
    if (moveable?.target) moveable.target = null;
    document
      .querySelectorAll(`.${IMAGE_MASK_CLICK_TARGET_CLASS}`)
      .forEach((el) => {
        el.remove();
      });
    sendPostMessage({ type: "setEditing", id: "" });
    hasAnyClick = false;
  };

  const handleKeydown = (e) => {
    const ARROW_KEYS = {
      left: "ArrowLeft",
      down: "ArrowDown",
      right: "ArrowRight",
      up: "ArrowUp",
    };

    const MODIFIER_SCALING = {
      alt: 10,
      shift: 5,
      default: 1,
    };

    const { key, altKey, shiftKey, ctrlKey, metaKey, view } = e;

    if (moveable.target && Object.values(ARROW_KEYS).includes(key)) {
      e.preventDefault();

      const scale = altKey
        ? MODIFIER_SCALING.alt
        : shiftKey
        ? MODIFIER_SCALING.shift
        : MODIFIER_SCALING.default;
      const direction = [ARROW_KEYS.left, ARROW_KEYS.right].includes(key)
        ? "horizontal"
        : "vertical";
      const delta =
        ([ARROW_KEYS.left, ARROW_KEYS.down].includes(key) ? -1 : 1) * scale;

      /**
       * Define an edge property only if the ctrlKey (metaKey → Command on Mac) is used.
       * Depending on the direction, the edge has either an 'x' or 'y' property ...
       * ... indicating the absolute final position.
       *
       * @note all iFrames have the same widths and height → can use first
       */
      const edge =
        ctrlKey || metaKey
          ? direction === "horizontal"
            ? { x: key === ARROW_KEYS.left ? 0 : view.innerWidth }
            : { y: key === ARROW_KEYS.up ? 0 : view.innerHeight }
          : undefined;

      /**
       * without ctrlKey, 'edge' is undefined and movement is relative to current position
       * with ctrlKey, movement is absolute (towards the edges of the document)
       */
      if (!edge) {
        // top left is (0,0) so need to adjust delta for vertical to be negative
        const deltaX = direction === "horizontal" ? delta : 0;
        const deltaY = direction === "vertical" ? -1 * delta : 0;

        moveable.request("draggable", { deltaX, deltaY }, true);
      } else {
        const { width, height } = moveable.getRect();

        if (edge.x !== undefined) {
          // for right edge, need to adjust by the width of the target to make sure it is fully visible
          const visibleX = edge.x > 0 ? edge.x - width : edge.x;
          moveable.request("draggable", { x: visibleX, deltaY: 0 }, true);
        } else if (edge.y !== undefined) {
          // for bottom edge, need to adjust by the height of the target to make sure it is fully visible
          const visibleY = edge.y > 0 ? edge.y - height : edge.y;
          moveable.request("draggable", { deltaX: 0, y: visibleY }, true);
        }
      }
    } else {
      const { activeElement } = document;
      const { lastChild } = activeElement ?? {};

      sendPostMessage({
        type: "keydown",
        key,
        modifiers: { ctrlKey, metaKey, shiftKey, altKey },
        textEdit: activeElement.classList.contains("editing"),
        isMaskedImage:
          moveable?.target?.classList.contains(IMAGE_MASK_CONTAINER_CLASS) ||
          moveable?.target?.parentNode?.classList.contains(
            IMAGE_MASK_CONTAINER_CLASS
          ),
        imgSrc:
          lastChild?.nodeName === "IMG"
            ? lastChild.getAttribute("src")
            : undefined,
      });
    }
  };

  document.addEventListener("keydown", handleKeydown);

  function strip(html) {
    let doc = new DOMParser().parseFromString(html, "text/html");

    return doc.body.textContent || "";
  }

  function handlePaste(e) {
    // Stop data actually being pasted into div
    e.stopPropagation();
    e.preventDefault();
    // Get pasted data via clipboard API
    const clipboardData = (e.clipboardData || window.clipboardData).getData(
      "text"
    );
    const textNode = document.createTextNode(strip(clipboardData));
    const selection = window.getSelection();
    if (!selection.rangeCount) return false;
    selection.deleteFromDocument();
    const range = selection.getRangeAt(0);
    range.insertNode(textNode);
    // move cursor to end of selection
    range.setStart(textNode, textNode.length);
    range.setEnd(textNode, textNode.length);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const addEditListeners = (el) => {
    const name = el.id;
    const value = el.innerHTML;
    const isCustom = el.classList.contains("custom");
    let changed = false;
    let newValue = null;

    const listener = function () {
      newValue = el.innerHTML;
      if (value !== newValue) changed = true;
    };

    const notifier = function () {
      if (!changed) return;
      if (!__parentWindow) return;
      if (!__parentOrigin) return;
      if (isCustom)
        sendPostMessage({ type: "updateCustomEdit", id: name, text: newValue });
      else
        sendPostMessage({
          type: "updateField",
          name,
          value: newValue,
          page: window.name,
        });
    };

    const updateAndNotify = () => {
      listener();
      notifier();
    };

    if (el.nodeName === "IMG" && el.id !== "propertyQrCode") {
      el.addEventListener("dragstart", (e) => e.preventDefault());
      el.addEventListener("drop", (e) => {
        preventDefault(e);
        handleImgDrop(e, name);
      });
      el.addEventListener("dragenter", (e) => {
        preventDefault(e);
        handleDragEnter(e);
      });
      el.addEventListener("dragover", (e) => e.preventDefault());
      el.addEventListener("dragleave", handleDragLeave);
    } else {
      if (el.contentEditable) el.style.minWidth = "1rem";
      el.addEventListener("input", updateAndNotify);
      el.addEventListener("blur", notifier);
      el.addEventListener("keyup", updateAndNotify);
      el.addEventListener("paste", handlePaste);
      el.addEventListener("change", updateAndNotify);
      el.addEventListener("copy", listener);
      el.addEventListener("cut", updateAndNotify);
      el.addEventListener("delete", updateAndNotify);
      el.addEventListener("mouseup", listener);
    }
  };

  Array.prototype.forEach.call(editableElements, function (el) {
    addEditListeners(el);
  });
  Array.prototype.forEach.call(customElements, function (el) {
    addEditListeners(el);
  });
};

window.onload = domLoaded();
