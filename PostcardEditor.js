import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Prompt, useHistory, useLocation, useParams } from "react-router";
import styled from "styled-components";
import MAILOUT_CREATORS from "src/store/modules/mailout/actions";
import {
  ButtonNoStyle,
  Icon,
  Loader,
  Input,
  Segment,
} from "src/components/Base";
import EditorHeader from "./EditorHeader";
import EditorNav, { NavButton } from "./EditorNav";
import { Link } from "react-router-dom";
import EditorSidebar from "./EditorSidebar";
import {
  CampaignNameDiv,
  EditorContent,
  EditorLayout,
  EditorPreview,
} from "./StyledComponents";
import { EditorToolbar } from "./EditorToolbar";
import { calcMargin } from "./utils/utils";
import { sleep } from "src/components/utils/utils";
import { faImages } from "@fortawesome/pro-regular-svg-icons";
import {
  faBolt,
  faLayerGroup,
  faShapes,
} from "@fortawesome/pro-solid-svg-icons";
import EditorTab from "./EditorTab";
import TemplatesTab from "./TemplatesTab";
import PhotosTab from "./PhotosTab";
import useIntersection from "src/components/Hooks/useIntersection";
import useHandlePostMessage from "./Hooks/useHandlePostMessage";
import useSendPostMessage from "./Hooks/useSendPostMessage";
import useHandleOnload from "./Hooks/useHandleOnload";
import useReloadIframes from "./Hooks/useReloadIframes";
import useHandleSave from "./Hooks/useHandleSave";
import useKeyBindings from "./Hooks/useKeyBindings";
import usePageTitle from "src/components/Hooks/usePageTitle";
import { useBestCTA } from "src/components/Hooks/useBestCTA";
import { statusApproved, StatusError } from "src/components/utils/helpers";
import AddShapesTab from "./ShapesSidebar/AddShapesTab";
import { liveEditorActions } from "src/store/modules/liveEditor/slice";
import { IframeLabel } from "src/pages/MailoutDetailsPage/IframeLabel";
import getInitialZoom from "src/pages/Editor/utils/getInitialZoom";
import { usePostcardUnsaved } from "src/pages/Editor/Hooks/usePostcardUnsaved";
import { Button } from "@brivity/marketer-components";
import { canPickDestinations } from "src/components/MailoutListItem/utils/helpers";
import IFramePreview from "src/pages/MailoutDetailsPage/IFramePreview";

const StyledIframeLabel = styled.div`
  margin-left: 16px;
  margin-bottom: calc(-1rem - 8px - 16px);
`;

export default function PostcardEditor() {
  const dispatch = useDispatch();
  const location = useLocation();
  const history = useHistory();
  const { mailoutId } = useParams();

  const isAutomated = location.pathname.includes("automated");
  const basePath = isAutomated ? "/create-automated/review/" : "/mailers/";

  const defaultCTA = useBestCTA(mailoutId);
  const previewRef = useRef(null);

  const {
    details,
    mailoutEdit,
    updateMailoutEditPending: savePending,
    updateMailoutEditSuccess: saveSuccess,
  } = useSelector((store) => store.mailout);

  if (details && !details.originalTemplate) {
    details.originalTemplate = {
      name: details.name,
      _id: details.templateTheme,
    };
  }

  const { cta: customCTA, mailoutStatus } = details ?? {};
  const isCTAHidden = mailoutEdit?.ctas?.hideCTA;

  const {
    reloadIframesPending,
    activePage,
    replaceFieldData,
    sidebarOpen,
    zoomValue,
    rotation,
    edits,
    editingInfo,
  } = useSelector((state) => state.liveEditor);

  const { page: editingPage, isCropping } = editingInfo ?? {};
  const { stencilEdits } = edits ?? {};

  const peerId = useSelector((store) => store.peer?.peerId);

  const [activeNavItem, setActiveNavItem] = useState(1);
  const [frontLoaded, setFrontLoaded] = useState(false);
  const [backLoaded, setBackLoaded] = useState(false);
  const [frontIframeNode, setFrontIframeNode] = useState(null);
  const [backIframeNode, setBackIframeNode] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [customizeCTA, setCustomizeCTA] = useState(false);
  const [newCTA, setNewCTA] = useState(defaultCTA);
  const [invalidCTA, setInvalidCTA] = useState(false);
  const [hideCTA, setHideCTA] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [colorPickerVal, setColorPickerVal] = useState(mailoutEdit?.brandColor);
  const [isNavigatingAway, setIsNavigatingAway] = useState(false);

  const isUnsaved = usePostcardUnsaved(newCampaignName);

  let rotateStyle = `${rotation}deg`;
  const threshold = [0, 0.2, 0.4, 0.6, 0.8, 1];

  const frontIntersection = useIntersection({
    node: frontIframeNode,
    root: previewRef?.current,
    threshold,
  });
  const backIntersection = useIntersection({
    node: backIframeNode,
    root: previewRef?.current,
    threshold,
  });

  const sendPostMessage = useSendPostMessage({
    frontIframeNode,
    backIframeNode,
  });
  // reload the iframes when triggered in redux store
  useReloadIframes({
    node: frontIframeNode,
    page: "front",
    setLoaded: setFrontLoaded,
  });
  useReloadIframes({
    node: backIframeNode,
    page: "back",
    setLoaded: setBackLoaded,
  });

  // inject the custom js and css into the iframes on load
  const handleOnload = useHandleOnload({ setBackLoaded, setFrontLoaded });

  usePageTitle("Mailer Campaign Editor");

  // set the active page by intersection observer
  useEffect(() => {
    const shouldUpdate =
      frontIntersection?.ratio < 1 || backIntersection.ratio < 1;
    if (!shouldUpdate) return;
    const newActivePage =
      frontIntersection.ratio > backIntersection.ratio ? 0 : 1;
    if (newActivePage !== activePage)
      dispatch(liveEditorActions.setActivePage(newActivePage));
    // eslint-disable-next-line
  }, [dispatch, frontIntersection, backIntersection]);

  useEffect(() => {
    // set nav item to templates if custom front and back
    if (mailoutEdit?.backResourceUrl && mailoutEdit?.frontResourceUrl)
      setActiveNavItem(0);
    // set the stencilEdits on load
    if (mailoutEdit?.stencilEdits?.elements?.length)
      dispatch(
        liveEditorActions.setStencilEdits(mailoutEdit.stencilEdits.elements)
      );
  }, [dispatch, mailoutEdit]);

  // reset the liveEditor state on unmount
  useEffect(() => {
    dispatch(liveEditorActions.setEditorType("postcard"));

    return () => {
      dispatch(liveEditorActions.resetLiveEdit());
      dispatch(MAILOUT_CREATORS.resetMailout());
    };
  }, [dispatch]);

  // handle key binding for deleting elements
  useKeyBindings({ sendPostMessage });

  useEffect(() => {
    setNewCTA(customCTA || defaultCTA);
    setCustomizeCTA(customCTA?.length > 0);
  }, [customCTA, defaultCTA]);

  useEffect(() => {
    setNewCampaignName(details?.name || details?.details?.displayAddress);
  }, [details]);

  useEffect(() => {
    const showSaveStatus = async () => {
      await sleep(2500);
      dispatch(MAILOUT_CREATORS.resetMailoutEditSuccess());
    };

    if (saveSuccess) {
      showSaveStatus();
    }
  }, [dispatch, saveSuccess]);

  useEffect(() => {
    if (isCTAHidden) {
      setHideCTA(true);
    }
  }, [isCTAHidden]);

  // replace the field data without reload when triggered in redux store
  useEffect(() => {
    if (replaceFieldData) {
      sendPostMessage("front", { type: "updateAllFields", replaceFieldData });
      sendPostMessage("back", { type: "updateAllFields", replaceFieldData });
      dispatch(liveEditorActions.setReplaceFieldData(false));
      dispatch(liveEditorActions.setReloadIframesPending(false));
    }
  }, [dispatch, replaceFieldData, mailoutEdit, sendPostMessage]);

  const updateIframeColor = useCallback(
    (side, colorHex) => {
      sendPostMessage(side, {
        type: "updateBrandColor",
        value: colorHex,
      });
    },
    [sendPostMessage]
  );

  useEffect(() => {
    dispatch(
      liveEditorActions.setLiveEditBrandColor(colorPickerVal?.hex || "")
    );

    if (frontIframeNode) {
      updateIframeColor("front", colorPickerVal?.hex);
    }

    if (backIframeNode) {
      updateIframeColor("back", colorPickerVal?.hex);
    }
  }, [
    colorPickerVal,
    dispatch,
    frontIframeNode,
    backIframeNode,
    updateIframeColor,
  ]);

  useEffect(() => {
    dispatch(MAILOUT_CREATORS.getMailoutPending(mailoutId));
    dispatch(MAILOUT_CREATORS.getMailoutEditPending(mailoutId));
  }, [dispatch, mailoutId]);

  const onFrontChange = useCallback((node) => {
    setFrontIframeNode(node);
  }, []);

  const onBackChange = useCallback((node) => {
    setBackIframeNode(node);
  }, []);

  useEffect(() => {
    const sendInitMessage = async (side) => {
      await sendPostMessage(side, "getAllEditableFieldsAsMergeVariables");
    };

    if (frontLoaded) sendInitMessage("front");
    if (backLoaded) sendInitMessage("back");
  }, [sendPostMessage, frontLoaded, backLoaded]);

  useEffect(() => {
    sendPostMessage("front", { type: "hideCTA", hideCTA: hideCTA });
    sendPostMessage("back", { type: "hideCTA", hideCTA: hideCTA });
    ["front", "back"].forEach((side) => {
      dispatch(
        liveEditorActions.updateElementCss({
          id: "_cta",
          page: side,
          display: hideCTA ? "none" : "initial",
        })
      );
    });
  }, [hideCTA, sendPostMessage, dispatch]);

  const handlePostMessage = useHandlePostMessage({
    pageIntersections: [frontIntersection, backIntersection],
    sendPostMessage,
  });

  useEffect(() => {
    window.addEventListener("message", handlePostMessage);

    return () => {
      window.removeEventListener("message", handlePostMessage);
    };
  }, [handlePostMessage]);

  useEffect(() => {
    sendPostMessage(editingPage === "front" ? "back" : "front", {
      type: "resetSelected",
    });

    if (stencilEdits.length && editingPage) {
      const fullCssString = stencilEdits.reduce((acc, el) => {
        if (el.cssPartial && (el.page === editingPage || !el.page)) {
          return (acc += el.cssPartial);
        } else return (acc += "");
      }, "");
      sendPostMessage(editingPage, { type: "customStyles", fullCssString });
    } else if (editingPage) {
      sendPostMessage(editingPage, { type: "customStyles", fullCssString: "" });
    }
  }, [editingPage, stencilEdits, sendPostMessage]);

  // toggle move/resize on image vs container
  useEffect(() => {
    sendPostMessage(editingPage, { type: "toggleCropMode", isCropping });
  }, [editingPage, isCropping, sendPostMessage]);

  // set the zoom level
  useEffect(() => {
    const zoomValue = getInitialZoom(details?.postcardSize);
    dispatch(liveEditorActions.setZoomValue(zoomValue));
  }, [details?.postcardSize, dispatch]);

  // navigate away upon REVIEW & SEND click
  useEffect(() => {
    if (isUnsaved || !isNavigatingAway) {
      return;
    }

    if (location.pathname.includes("automated")) {
      history.push(`${basePath}${mailoutId}`);
    } else {
      history.push(`/mailers/${mailoutId}`, { showConsentModal: true });
    }
  }, [
    basePath,
    history,
    isNavigatingAway,
    isUnsaved,
    location.pathname,
    mailoutId,
  ]);

  const handleSave = useHandleSave({
    newCTA,
    hideCTA,
    customizeCTA,
    invalidCTA,
    setActiveNavItem,
    sendPostMessage,
    newCampaignName,
    setEditingName,
  });

  // save then navigate away
  const handleReviewAndSendClick = () => {
    handleSave({});
    setIsNavigatingAway(true);
  };

  const navItems = [
    {
      name: "Templates",
      icon: faLayerGroup,
      component: (
        <TemplatesTab handleSave={handleSave} mailoutDetails={details} />
      ),
      hide: false,
    },
    {
      name: "Dynamic",
      icon: faBolt,
      hide: mailoutEdit?.frontResourceUrl && mailoutEdit?.backResourceUrl,
      component: (
        <EditorTab
          colorPickerVal={colorPickerVal}
          customCTA={customCTA}
          customizeCTA={customizeCTA}
          hideCTA={hideCTA}
          handleSave={handleSave}
          invalidCTA={invalidCTA}
          newCTA={newCTA}
          defaultCTA={defaultCTA}
          sendPostMessage={sendPostMessage}
          setColorPickerVal={setColorPickerVal}
          setCustomizeCTA={setCustomizeCTA}
          setHideCTA={setHideCTA}
          setInvalidCTA={setInvalidCTA}
          setNewCTA={setNewCTA}
          stencilEdits={stencilEdits}
        />
      ),
    },
    {
      name: "Photos",
      icon: faImages,
      hide: mailoutEdit?.frontResourceUrl && mailoutEdit?.backResourceUrl,
      component: <PhotosTab sendPostMessage={sendPostMessage} />,
    },
    {
      name: "Elements",
      icon: faShapes,
      hide: mailoutEdit?.frontResourceUrl && mailoutEdit?.backResourceUrl,
      component: <AddShapesTab sendPostMessage={sendPostMessage} />,
    },
  ];

  const frontURL = peerId
    ? `/api/user/${details?.userId}/peer/${peerId}/mailout/${details?._id}/render/preview/html/front/edit?edit=true&showBleed=true&postagePlaceholder=true`
    : `/api/user/${details?.userId}/mailout/${details?._id}/render/preview/html/front/edit?edit=true&showBleed=true&postagePlaceholder=true`;

  const backURL = peerId
    ? `/api/user/${details?.userId}/peer/${peerId}/mailout/${details?._id}/render/preview/html/back/edit?edit=true&showBleed=true&postagePlaceholder=true`
    : `/api/user/${details?.userId}/mailout/${details?._id}/render/preview/html/back/edit?edit=true&showBleed=true&postagePlaceholder=true`;

  return (
    <>
      {details ? (
        statusApproved.includes(details.mailoutStatus) ? (
          <Segment>
            <StatusError>
              <span>
                Campaigns that have been Approved & Sent cannot be edited.
              </span>{" "}
              <Link to={basePath + mailoutId}>
                <Button>
                  <Icon name='left arrow' />
                  Campaign Details
                </Button>
              </Link>
            </StatusError>
          </Segment>
        ) : (
          <EditorLayout
            sidebarOpen={sidebarOpen}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              sendPostMessage("front", { type: "resetSelected" });
              sendPostMessage("back", { type: "resetSelected" });
              dispatch(liveEditorActions.resetElementSelection());
            }}
          >
            <Prompt
              when={isUnsaved}
              message='You have unsaved changes. Proceed without saving? (You will lose all unsaved progress)'
            />
            <EditorHeader>
              <div className='header-left'>
                {details?._id && (
                  <ButtonNoStyle as={Link} to={basePath + details._id}>
                    <Icon className='back-btn' name='chevron left' />
                  </ButtonNoStyle>
                )}
                <CampaignNameDiv>
                  {editingName ? (
                    <>
                      <Input
                        value={newCampaignName}
                        onChange={(e) => setNewCampaignName(e.target.value)}
                        onFocus={() =>
                          dispatch(liveEditorActions.setInputFocus(true))
                        }
                        onBlur={() =>
                          dispatch(liveEditorActions.setInputFocus(false))
                        }
                      ></Input>
                    </>
                  ) : (
                    <>
                      <h1>{newCampaignName}</h1>
                      <ButtonNoStyle onClick={() => setEditingName(true)}>
                        <Icon name='pencil' />
                      </ButtonNoStyle>
                    </>
                  )}
                </CampaignNameDiv>
              </div>
              <div className='header-right'>
                <div id='save-status'>
                  {savePending ? (
                    <>
                      <Icon name='cloud upload' />
                      <span>Saving changes</span>
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Icon name='checkmark' />
                      <span>Changes Saved</span>
                    </>
                  ) : null}
                </div>
                <Button
                  theme='secondary'
                  disabled={savePending}
                  onClick={() => handleSave({})}
                >
                  Save
                </Button>
                {canPickDestinations(mailoutStatus) ? (
                  <Link to={`/mailers/edit/${mailoutId}/destinations`}>
                    <Button className='ml-4'>Choose Destinations</Button>
                  </Link>
                ) : (
                  <Button
                    className='ml-4'
                    disabled={savePending}
                    onClick={handleReviewAndSendClick}
                  >
                    Review & Send
                  </Button>
                )}
              </div>
            </EditorHeader>
            <EditorNav>
              {navItems.map(
                (item, ind) =>
                  !item.hide && (
                    <NavButton
                      key={item.name}
                      className={`${ind === activeNavItem ? "active" : null}`}
                      icon={item.icon}
                      tooltip={item.name}
                      onClick={() => {
                        setActiveNavItem(ind);
                        dispatch(liveEditorActions.setSidebarOpen(true));
                      }}
                    />
                  )
              )}
            </EditorNav>
            <EditorSidebar
              activeTabIcon={navItems[activeNavItem].icon}
              activeTabTitle={navItems[activeNavItem].name}
            >
              {navItems[activeNavItem].component}
            </EditorSidebar>
            <EditorContent>
              <EditorToolbar
                sendPostMessage={sendPostMessage}
                isDocument={false}
              />
              {details && (
                <EditorPreview
                  ref={previewRef}
                  onClick={() => {
                    sendPostMessage("front", { type: "resetSelected" });
                    sendPostMessage("back", { type: "resetSelected" });
                    dispatch(liveEditorActions.resetElementSelection());
                  }}
                >
                  <div>
                    <StyledIframeLabel>
                      <IframeLabel
                        postcardSize={details?.postcardSize}
                        page={1}
                      />
                    </StyledIframeLabel>

                    <IFramePreview
                      showSafeZone={true}
                      active={activePage === 0}
                      campaignId={details?._id}
                      isLoaded={frontLoaded}
                      resourceUrl={details?.frontResourceUrl || null}
                      frameUrl={frontURL}
                      handleOnload={handleOnload}
                      postcardSize={details?.postcardSize}
                      ref={onFrontChange}
                      reloadPending={reloadIframesPending}
                      scale={zoomValue}
                      side='front'
                      rotate={rotateStyle}
                      margin={calcMargin(
                        details?.postcardSize,
                        rotation,
                        zoomValue
                      )}
                      templateName={details.name}
                      originalTemplate={details.templateTheme || details._id}
                    />

                    <StyledIframeLabel>
                      <IframeLabel
                        postcardSize={details?.postcardSize}
                        page={2}
                      />
                    </StyledIframeLabel>
                    <IFramePreview
                      showSafeZone={true}
                      active={activePage === 1}
                      campaignId={details?._id}
                      isLoaded={backLoaded}
                      resourceUrl={details?.backResourceUrl || null}
                      frameUrl={backURL}
                      handleOnload={handleOnload}
                      postcardSize={details?.postcardSize}
                      ref={onBackChange}
                      reloadPending={reloadIframesPending}
                      scale={zoomValue}
                      side='back'
                      rotate={rotateStyle}
                      margin={calcMargin(
                        details?.postcardSize,
                        rotation,
                        zoomValue
                      )}
                      templateName={details.name}
                      originalTemplate={details.templateTheme || details._id}
                      backTemplateTheme={details.backTemplateTheme}
                    />
                  </div>
                </EditorPreview>
              )}
            </EditorContent>
          </EditorLayout>
        )
      ) : (
        <Loader active />
      )}
    </>
  );
}
