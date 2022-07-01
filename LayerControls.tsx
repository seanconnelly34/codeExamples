import { useDispatch, useSelector } from "src/hooks/useRedux";
import { liveEditorActions } from "src/store/modules/liveEditor/slice";
import { ToolbarIconButton } from "@brivity/marketer-components";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { Popup } from "src/components/Base";
import {
  faBringForward,
  faBringFront,
  faSendBack,
  faSendBackward,
} from "@fortawesome/pro-solid-svg-icons";

type LayerTextOptionsProps = {
  popupText: string,
  value: number,
  icon: IconProp,
};

export function LayerControls() {
  const dispatch = useDispatch();
  const activePage = useSelector((state) => state.liveEditor.activePage);
  const editorType = useSelector((state) => state.liveEditor.editorType);
  const extremeZIndex = useSelector((state) => state.liveEditor.extremeZIndex);
  const zIndex = useSelector((state) => state.liveEditor.styles.zIndex || 0);
  const page = useSelector((state) => state.liveEditor.editingInfo.page);

  const { minZIndex = 0, maxZIndex = 0 } = extremeZIndex ?? {};

  const activePageName =
    editorType === "postcard"
      ? activePage === 0
        ? "front"
        : "back"
      : `${activePage}`;

  const changeZIndex = (value: number) => {
    // Adjust extremum values
    if (page === activePageName) {
      if (value > maxZIndex) {
        dispatch(
          liveEditorActions.setExtremeZIndex({ minZIndex, maxZIndex: value })
        );
      } else if (value < minZIndex) {
        dispatch(
          liveEditorActions.setExtremeZIndex({ minZIndex: value, maxZIndex })
        );
      }
    }

    dispatch(liveEditorActions.updateElementCss({ "z-index": `${value}` }));
    dispatch(liveEditorActions.updateCurrentStyles({ zIndex: value }));
  };

  const layerTextOptions: LayerTextOptionsProps[] = [
    {
      popupText: "Send to Back",
      value: minZIndex - 1,
      icon: faSendBack,
    },
    {
      popupText: "Send Backwards",
      value: Number(zIndex) - 1,
      icon: faSendBackward,
    },
    {
      popupText: "Bring Forwards",
      value: Number(zIndex) + 1,
      icon: faBringForward,
    },
    {
      popupText: "Bring to Front",
      value: maxZIndex + 1,
      icon: faBringFront,
    },
  ];

  return (
    <>
      {layerTextOptions.map((item) => (
        <Popup
          key={item.popupText}
          content={item.popupText}
          inverted
          position='bottom left'
          on='hover'
          trigger={
            <div>
              <ToolbarIconButton
                icon={item.icon}
                onclick={() => changeZIndex(item.value)}
              />
            </div>
          }
        />
      ))}
    </>
  );
}
