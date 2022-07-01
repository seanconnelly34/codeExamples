import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Popup, CloseOverlay } from "src/components/Base";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAdjust } from "@fortawesome/pro-regular-svg-icons";
import useDeleteElement from "src/pages/Editor/Hooks/useDeleteElement";
import { DropdownControl } from "src/pages/Editor/StyledComponents/DropdownControl";
import Toolbar from "src/pages/Editor/StyledComponents/Toolbar";
import ToolbarSeparator from "src/pages/Editor/StyledComponents/ToolbarSeparator";
import ToolbarButton from "src/pages/Editor/StyledComponents/ToolbarButton";
import PageControls from "./PageControls";
import TextControls from "./TextControls";
import ImageControls from "./ImageControls";
import ShapeControls from "./ShapeControls";
import GridLinesToggle from "./GridLinesToggle";
import useSetExtremumZIndex from "src/pages/Editor/Hooks/useSetExtremumZIndex";
import SizeInputs from "./SizeInputs";
import useSendAllPagesPostMessage from "src/pages/Editor/Hooks/useSendAllPagesPostMessage";
import { liveEditorActions } from "src/store/modules/liveEditor/slice";
import { ZoomButtonMenu } from "@brivity/marketer-components";
import { AddTextDropdownMenu } from "@brivity/marketer-components";
import AddTextTab from "../AddTextTab";
import { LayerControls } from "src/pages/Editor/EditorToolbar/LayerControls";
import { useResizeObserver } from "src/components/Hooks/useResizeObserver";
import { ToolbarIconButton } from "@brivity/marketer-components";
import { faTrashAlt } from "@fortawesome/pro-solid-svg-icons";
import { faUndoAlt, faSyncAlt } from "@fortawesome/pro-solid-svg-icons";
import { EyeLinesButton } from "./EyeLinesButton";

export default function EditorToolbar({
  sendPostMessage,
  isDocument,
  maxPages,
  setScrollToIndex,
}) {
  const dispatch = useDispatch();
  const initialFields = useSelector(
    (state) => state.mailout.mailoutEdit?.fields
  );

  const isDesigner =
    useSelector((state) => state.profile?.available?.editingMode) ===
    "advanced";

  const {
    zoomValue,
    rotation,
    opacityMenuOpen,
    activePage,
    editorType,
    edits,
    styles,
    editingInfo,
    showSafeZone,
  } = useSelector((state) => state.liveEditor);

  const { fields, pages, stencilEdits } = edits ?? {};
  const { opacity } = styles ?? {};
  const { page, id, type, canResize, isMaskedImage } = editingInfo ?? {};

  const [selectedChanged, setSelectedChanged] = useState(false);
  const [transparencyPopupOpen, setTransparencyPopupOpen] = useState(false);
  const [initialFieldValue, setInitialFieldValue] = useState(null);

  const activePageName =
    editorType === "postcard"
      ? activePage === 0
        ? "front"
        : "back"
      : `${activePage}`;

  /** Set extremum z-indices on page change */
  useSetExtremumZIndex(activePageName);

  const findInitialValue = useCallback(
    (fields, _id) => {
      const findId = _id || id;

      return fields?.find((el) => el.name === findId)?.value;
    },
    [id]
  );

  useEffect(() => {
    const initialValue = findInitialValue(
      editorType === "postcard" ? initialFields : fields
    );
    setInitialFieldValue(initialValue);
  }, [id, editorType, findInitialValue, initialFields, fields]);

  useEffect(() => {
    if (!id) {
      setSelectedChanged(false);

      return;
    }

    const stencilEdit = stencilEdits?.find((el) => el.id === `${id}-${page}`);
    const maskEdit =
      id.indexOf("Mask") === -1
        ? stencilEdits?.find((el) => el.id === `${id}Mask-${page}`)
        : stencilEdits?.find(
            (el) => el.id === `${id.replace("Mask", "")}-${page}`
          );

    if (stencilEdit || maskEdit) {
      setSelectedChanged(true);

      return;
    }

    const fieldValue =
      editorType === "postcard"
        ? fields?.find((el) => el.name === id)?.value
        : pages[page]?.mergeVariables?.[id];
    const initialValue = findInitialValue(
      editorType === "postcard" ? initialFields : fields
    );
    if (fieldValue && initialValue && fieldValue !== initialValue)
      setSelectedChanged(true);
    else setSelectedChanged(false);
  }, [
    id,
    page,
    editorType,
    fields,
    findInitialValue,
    initialFields,
    pages,
    stencilEdits,
  ]);

  const handleRotate = () => {
    dispatch(liveEditorActions.setRotation((rotation + 90) % 360));
  };

  const deleteElement = useDeleteElement({ sendPostMessage });

  const handleSafeZone = (showSafeZone) => {
    dispatch(liveEditorActions.setSafeZone(!showSafeZone));
    sendAllPostMessages({ type: "showSafeZone", showSafeZone });
    ["front", "back"].forEach((side) => {
      dispatch(
        liveEditorActions.updateElementCss({
          id: "safe-zone",
          page: side,
          display: showSafeZone ? "initial" : "none",
        })
      );
    });
  };

  const handleResetElement = () => {
    let _id = id;
    let value = initialFieldValue;

    // this ensures the reset click always passes the image ID, in case the image is contained for cropping / masking
    // and that we reset both the Mask and the Image edits in a reset for either
    if (isMaskedImage) {
      if (_id.indexOf("Mask") > -1) {
        // is a Mask-ing div, reset Mask edits
        // and ensure setFieldValue targets the image:
        dispatch(liveEditorActions.deleteStencilEdit(_id));
        _id = _id.replace("Mask", "");
        value = findInitialValue(
          editorType === "postcard" ? initialFields : fields,
          _id
        );
      } else {
        // is a Mask-ed <IMG />, reset the Mask edits only
        dispatch(liveEditorActions.deleteStencilEdit(`${_id}Mask`));
      }
    }

    dispatch(liveEditorActions.deleteStencilEdit(_id));
    sendPostMessage(page, {
      type: "setFieldValue",
      id: _id,
      value,
    });
    sendPostMessage(page, { type: "removeTransform", id: _id });
  };

  const sendAllPostMessages = useSendAllPagesPostMessage({});

  /** Send zoom value to all iframes on change */
  const sendZoomToAllIframes = (zoomValue) => {
    dispatch(liveEditorActions.setZoomValue(zoomValue));
    sendAllPostMessages({ type: "updateZoom", zoomValue });
  };

  const toolbarRef = useRef(null);
  const [toolbarWidth] = useResizeObserver(toolbarRef);

  return (
    <Toolbar ref={toolbarRef}>
      <ZoomButtonMenu>
        <div className='flex items-center gap-2'>
          <span id='control-title'>Zoom</span>
          <input
            className='range-input'
            type='range'
            min='0.25'
            max='1.5'
            step='0.05'
            value={zoomValue}
            onChange={(e) => {
              sendZoomToAllIframes(e.target.value);
            }}
          />
          <span id='control-value'>{Math.round(zoomValue * 100)}%</span>
        </div>
      </ZoomButtonMenu>
      <EyeLinesButton
        popupText={showSafeZone ? "Visible" : "Hidden"}
        onclick={() => handleSafeZone(showSafeZone)}
        active={showSafeZone}
      />
      <Popup
        content='Rotate Pages'
        inverted
        position='bottom left'
        on='hover'
        trigger={
          <div>
            <ToolbarIconButton
              icon={faSyncAlt}
              onclick={() => handleRotate()}
            />
          </div>
        }
      />

      <Popup
        content='Add Text Block'
        inverted
        position='top center'
        on='hover'
        trigger={
          <div>
            <AddTextDropdownMenu>
              <div className='items-center gap-2'>
                <AddTextTab sendPostMessage={sendPostMessage} />
              </div>
            </AddTextDropdownMenu>
          </div>
        }
      />
      {isDesigner && <GridLinesToggle />}
      {id && (
        <>
          <ToolbarSeparator />
          <Popup
            content='Transparency'
            inverted
            position='bottom left'
            on='hover'
            open={transparencyPopupOpen}
            onOpen={() => setTransparencyPopupOpen(true)}
            onClose={() => setTransparencyPopupOpen(false)}
            trigger={
              <ToolbarButton
                onClick={() => {
                  dispatch(liveEditorActions.setOpacityMenuOpen(true));
                  setTransparencyPopupOpen(false);
                }}
              >
                <FontAwesomeIcon icon={faAdjust} transform='flip-h' />
                {opacityMenuOpen && id && (
                  <>
                    <CloseOverlay
                      onClick={(e) => {
                        dispatch(liveEditorActions.setOpacityMenuOpen(false));
                        e.stopPropagation();
                      }}
                    />
                    <DropdownControl>
                      <span id='control-title'>Transparency</span>
                      <input
                        className='range-input'
                        type='range'
                        min='0'
                        max='1'
                        step='0.05'
                        value={opacity}
                        onChange={(e) => {
                          const obj = { opacity: e.target.value };
                          dispatch(liveEditorActions.updateCurrentStyles(obj));
                          dispatch(liveEditorActions.updateElementCss(obj));
                        }}
                      />
                      <span id='control-value'>
                        {Math.round(opacity * 100)}%
                      </span>
                    </DropdownControl>
                  </>
                )}
              </ToolbarButton>
            }
          />
        </>
      )}
      {type === "image" && <ImageControls />}
      {(type === "image" || type === "shape") && canResize && (
        <SizeInputs sendPostMessage={sendPostMessage} />
      )}

      {selectedChanged && !id?.includes("custom") && (
        <Popup
          content='Undo'
          inverted
          position='bottom left'
          on='hover'
          trigger={
            <div>
              <ToolbarIconButton
                name='undo'
                icon={faUndoAlt}
                popupText='Reset element'
                onclick={() => handleResetElement()}
              />
            </div>
          }
        />
      )}
      {type === "shape" && <ShapeControls sendPostMessage={sendPostMessage} />}

      {id && type !== "text" && (
        <Popup
          content='Delete'
          inverted
          position='bottom left'
          on='hover'
          trigger={
            <div>
              <ToolbarIconButton
                theme='red'
                icon={faTrashAlt}
                onclick={() => deleteElement()}
              />
            </div>
          }
        />
      )}

      {id && type !== "text" && (
        <>
          <LayerControls />
          <Popup
            content='Delete Element'
            inverted
            position='bottom center'
            on='hover'
            trigger={
              <div>
                <ToolbarIconButton
                  theme='red'
                  icon={faTrashAlt}
                  onclick={() => deleteElement()}
                />
              </div>
            }
          />
        </>
      )}
      {isDocument && (
        <PageControls maxPages={maxPages} setScrollToIndex={setScrollToIndex} />
      )}
      {type === "text" && (
        <TextControls
          deleteElement={deleteElement}
          overflow={toolbarWidth < 1400}
        />
      )}
    </Toolbar>
  );
}
