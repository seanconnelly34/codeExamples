import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { cloneDeep } from "lodash";
import parse from "style-to-object";
import { Page } from "src/typings/apiDesign";
import { ITemplateDoc } from "src/typings/apiTemplates";
import { EditElement, IEditDetails } from "src/typings/apiDocuments";

export interface ILiveEditorInitState {
  showSafeZone: boolean;
  editorType: string;
  copyElement: EditElement;
  reloadIframes: boolean;
  reloadIframesPending: boolean;
  replaceFieldData: boolean;
  dropDownCards: IDropDownCards;
  sidebarOpen: boolean;
  printSidebarOpen: boolean;
  opacityMenuOpen: boolean;
  pageIntersections: number[];
  pagesPendingSave: (string | number)[];
  activePage: number;
  zoomValue: number;
  modalZoomValue: number;
  rotation: number;
  selectedTemplate: ITemplateDoc | null;
  editingInfo: IEditingInfo;
  styles: IEditorStyles;
  extremeZIndex: IExtremeZIndex;
  edits: IEdits;
  qrCodeInputValue: string;
  qrCodeSavedValue: string;
  qrCodeSavePending: boolean;
  qrCodeSaveError: string;
  showGridLines: boolean;
  inputFocus: boolean;
}

export interface IDropDownCards {
  frontTemplate?: boolean;
  backTemplate?: boolean;
  MLSPhotos?: boolean;
  Logos?: boolean;
  myUploads?: boolean;
  teamPhotos?: boolean;
  globalPhotos?: boolean;
  clippedImagesOpen?: boolean;
  shapesOpen?: boolean;
  iconsOpen?: boolean;
}

export interface IEditingInfo {
  id?: string;
  type?: string;
  mode?: string;
  page?: string | number;
  canResize?: boolean;
  isMaskedImage?: boolean;
  isCropping?: boolean;
}

export interface IEdits {
  brandColor?: string;
  pages?: Page[];
  fields?: IField[];
  stencilEdits?: EditElement[];
}

export interface IField {
  page?: string | number;
  name: string;
  sides?: string[];
  value: string;
}

export interface IExtremeZIndex {
  minZIndex?: number;
  maxZIndex?: number;
}

export interface IEditorStyles {
  fontFamily?: string;
  fontSize?: string | number;
  lineHeight?: string | number;
  letterSpacing?: string | number;
  textAlign?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  textDecoration?: string;
  textTransform?: string;
  color?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: string | number;
  opacity?: string | number;
  zIndex?: string | number;
  objectFit?: string;
  objectPosition?: string;
}

const initialState: ILiveEditorInitState = {
  showSafeZone: true,
  editorType: "",
  copyElement: {},
  reloadIframes: false,
  reloadIframesPending: false,
  replaceFieldData: false,
  dropDownCards: {
    frontTemplate: false,
    backTemplate: false,
    MLSPhotos: false,
    Logos: false,
    myUploads: false,
    teamPhotos: false,
    globalPhotos: false,
    clippedImagesOpen: false,
    shapesOpen: false,
    iconsOpen: false,
  },
  sidebarOpen: true,
  printSidebarOpen: false,
  opacityMenuOpen: false,
  pageIntersections: [],
  pagesPendingSave: [],
  activePage: 0,
  zoomValue: 1,
  modalZoomValue: 0.5,
  rotation: 0,
  selectedTemplate: null,
  editingInfo: {
    id: "",
    type: "",
    mode: "",
    page: "",
    canResize: false,
    isCropping: true,
    isMaskedImage: false,
  },
  styles: {
    fontFamily: "",
    fontSize: "",
    lineHeight: "",
    letterSpacing: "",
    textAlign: "",
    fontWeight: "",
    fontStyle: "",
    textDecoration: "",
    textTransform: "",
    color: "",
    fill: "",
    stroke: "",
    strokeWidth: "",
    opacity: 1,
    zIndex: 0,
    objectFit: "",
    objectPosition: "",
  },
  extremeZIndex: { minZIndex: 10, maxZIndex: 10 },
  edits: {
    brandColor: "",
    pages: [],
    fields: [],
    stencilEdits: [],
  },
  qrCodeInputValue: "",
  qrCodeSavedValue: "",
  qrCodeSavePending: false,
  qrCodeSaveError: "",
  showGridLines: false,
  inputFocus: false,
};

const getNewEditId = (id: string, newPageIndex: string) =>
  id?.substring(0, id?.lastIndexOf("-") + 1) + newPageIndex;

const liveEditor = createSlice({
  name: "liveEditor",
  initialState,
  reducers: {
    setSafeZone: (state, action: PayloadAction<boolean>) => {
      state.showSafeZone = action.payload;
    },
    setEditorType: (state, action: PayloadAction<string>) => {
      state.editorType = action.payload;
    },
    setCopyElement: (state, action: PayloadAction<EditElement>) => {
      state.copyElement = action.payload;
    },
    setReloadIframes: (state, action: PayloadAction<boolean>) => {
      state.reloadIframes = action.payload;
    },
    setReloadIframesPending: (state, action: PayloadAction<boolean>) => {
      state.reloadIframesPending = action.payload;
    },
    setReplaceFieldData: (state, action: PayloadAction<boolean>) => {
      state.replaceFieldData = action.payload;
    },
    setDropdownCardsOpen: (state, action: PayloadAction<IDropDownCards>) => {
      state.dropDownCards = action.payload;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setPrintSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.printSidebarOpen = action.payload;
    },
    setOpacityMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.opacityMenuOpen = action.payload;
    },
    toggleImageCropMode: (state) => {
      state.editingInfo.isCropping = !state.editingInfo.isCropping;
    },
    updatePageIntersections: (
      state,
      action: PayloadAction<{ page: number, ratio: number }>
    ) => {
      const newIntersections = [...(state.pageIntersections || [])];
      const { page, ratio } = action.payload;
      newIntersections[page] = ratio;

      // do not update the active page on scroll if two pages are fully visible
      if (newIntersections.filter((ratio) => ratio === 1).length > 1) {
        return { ...state, pageIntersections: newIntersections };
      }

      // set the active page to the page with highest visible ratio
      const mostVisible = Math.max(...newIntersections);
      const newActivePage = newIntersections.indexOf(mostVisible);
      state.pageIntersections = newIntersections;
      state.activePage = newActivePage;
    },
    setPagesPendingSave: (
      state,
      action: PayloadAction<(string | number)[]>
    ) => {
      state.pagesPendingSave = action.payload;
    },
    setActivePage: (state, action: PayloadAction<number>) => {
      state.activePage = action.payload;
    },
    setZoomValue: (state, action: PayloadAction<number>) => {
      state.zoomValue = action.payload;
    },
    setModalZoomValue: (state, action: PayloadAction<number>) => {
      state.modalZoomValue = action.payload;
    },
    setRotation: (state, action: PayloadAction<number>) => {
      state.rotation = action.payload;
    },
    setSelectedTemplate: (state, action: PayloadAction<ITemplateDoc>) => {
      state.selectedTemplate = action.payload;
    },
    updateEditingInfo: (
      state,
      action: PayloadAction<Partial<IEditingInfo>>
    ) => {
      state.editingInfo = { ...state.editingInfo, ...action.payload };
    },
    updateCurrentStyles: (
      state,
      action: PayloadAction<Partial<IEditorStyles>>
    ) => {
      state.styles = { ...state.styles, ...action.payload };
    },
    setExtremeZIndex: (
      state,
      action: PayloadAction<{ minZIndex: number, maxZIndex: number }>
    ) => {
      state.extremeZIndex = action.payload;
    },
    setStencilEdits: (state, action: PayloadAction<EditElement[]>) => {
      state.edits.stencilEdits = action.payload;
    },
    setLiveEditFields: (state, action: PayloadAction<IField[]>) => {
      state.edits.fields = action.payload;
    },
    setDocumentEdits: (state, action: PayloadAction<IEditDetails>) => {
      const { brandColor, pages } = { ...action.payload };
      const stencilEdits = cloneDeep(action.payload.stencilEdits?.elements);
      state.edits = { ...state.edits, brandColor, pages, stencilEdits };
    },
    setChangedDocumentField: (state, action: PayloadAction<IField>) => {
      const { page, name, value } = action.payload;
      const newPages =
        state.edits.pages &&
        [...state.edits.pages].map((pageData, ind) => {
          if (ind !== Number(page) && page !== "all") return pageData;
          else {
            if (!pageData.mergeVariables)
              return { ...pageData, mergeVariables: [{ name, value }] };
            const varExists = pageData.mergeVariables.findIndex(
              (mergeVar) => mergeVar.name === name
            );

            if (varExists === -1)
              return {
                ...pageData,
                mergeVariables: [...pageData.mergeVariables, { name, value }],
              };
            else {
              const newMergeVars = pageData?.mergeVariables?.map(
                (mergeVar, ind) => {
                  if (ind !== varExists) return mergeVar;
                  else return { name, value };
                }
              );

              return { ...pageData, mergeVariables: newMergeVars };
            }
          }
        });
      state.edits.pages = newPages;
    },
    mergeLiveEditFields: (state, action: PayloadAction<IField[]>) => {
      const newFields = [...(state.edits.fields || [])];
      const updateFields = [...action.payload];
      updateFields.forEach((field) => {
        const ind = newFields.findIndex((el) => el.name === field.name);
        if (ind === -1) newFields.push(field);
        else newFields[ind].value = field.value;
      });
      state.edits.fields = newFields;
    },
    setLiveEditBrandColor: (state, action: PayloadAction<string>) => {
      state.edits.brandColor = action.payload;
    },
    addPage: (
      state,
      action: PayloadAction<{
        pageIndex?: number,
        pageInfo: Page,
        isDuplicate?: boolean,
      }>
    ) => {
      const { pageInfo, isDuplicate } = action.payload;
      const pageIndex = action.payload.pageIndex ?? state.activePage + 1;
      const newPages = JSON.parse(JSON.stringify(state.edits.pages));
      newPages.splice(pageIndex, 0, pageInfo);
      const newStencilEdits = state.edits.stencilEdits?.flatMap((edit) => {
        const pageNumber = Number(edit.page);

        // Duplicate the stencilEdits for a duplicated page
        if (pageNumber === pageIndex - 1 && isDuplicate) {
          return [
            { ...edit },
            {
              ...edit,
              page: `${pageNumber + 1}`,
              id: getNewEditId(edit.id || "", `${pageNumber + 1}`),
            },
          ];
        }

        // Increase the page values for all the stencil edits higher than the inserted page (+1)
        if (pageNumber >= pageIndex) {
          return [
            {
              ...edit,
              page: `${pageNumber + 1}`,
              id: getNewEditId(edit.id || "", `${pageNumber + 1}`),
            },
          ];
        }

        return [edit];
      });
      // Need to save and reload all pages after the new page
      const pagesPendingSave = newPages.flatMap((cur: Page, ind: number) => {
        if (ind >= pageIndex) return [ind];

        return [];
      });
      state.edits.pages = newPages;
      state.edits.stencilEdits = newStencilEdits;
      state.pagesPendingSave = pagesPendingSave;
    },
    deletePage: (state) => {
      const pageIndex = state.activePage;
      // remove the pageIntersection data
      const newPageIntersections = [...state.pageIntersections];
      newPageIntersections.splice(pageIndex, 1);
      const newPages = JSON.parse(JSON.stringify(state.edits.pages));
      newPages.splice(pageIndex, 1);
      const newStencilEdits = state.edits.stencilEdits?.flatMap((edit) => {
        const newPageIndex = `${Number(edit.page) - 1}`;
        // Remove the stencilEdits for deleted page
        if (Number(edit.page) === pageIndex) return [];

        // Decrease the page value for all pages > deletedPage (-1)
        if (Number(edit.page) > pageIndex) {
          return [
            {
              ...edit,
              page: newPageIndex,
              id: getNewEditId(edit.id || "", newPageIndex),
            },
          ];
        }

        return [edit];
      });
      // Need to save and reload all pages after the deleted page
      const pagesPendingSave = newPages.flatMap((cur: Page, ind: number) => {
        if (ind >= pageIndex) return [ind];

        return [];
      });
      // If no iframes need reloaded trigger save without reload
      if (pagesPendingSave.length === 0) pagesPendingSave.push("noReload");
      state.edits.pages = newPages;
      state.edits.stencilEdits = newStencilEdits;
      state.pageIntersections = newPageIntersections;
      state.pagesPendingSave = pagesPendingSave;
    },
    movePage: (state, action: PayloadAction<{ direction: "up" | "down" }>) => {
      const { direction } = action.payload;
      const activePage = state.activePage;
      const targetPage = direction === "up" ? activePage - 1 : activePage + 1;
      const newPages = cloneDeep(state.edits.pages);

      // swap pages
      if (newPages && newPages.length > targetPage) {
        const tempPage = newPages?.[targetPage];
        newPages[targetPage] = newPages[activePage];
        newPages[activePage] = tempPage;
      }

      // swap stencilEdits
      const newStencilEdits = state.edits.stencilEdits?.flatMap((edit) => {
        if (Number(edit.page) === activePage) {
          return [
            {
              ...edit,
              page: `${targetPage}`,
              id: getNewEditId(edit.id || "", `${targetPage}`),
            },
          ];
        }

        if (Number(edit.page) === targetPage) {
          return [
            {
              ...edit,
              page: `${activePage}`,
              id: getNewEditId(edit.id || "", `${activePage}`),
            },
          ];
        }

        return [{ ...edit }];
      });
      // Need to save and reload all pages after the moved page
      state.pagesPendingSave = [activePage, targetPage];
      state.edits.pages = newPages;
      state.edits.stencilEdits = newStencilEdits;
    },
    addStencilEdit: (state, action: PayloadAction<EditElement[]>) => {
      state.edits.stencilEdits = [
        ...(state.edits.stencilEdits || []),
        ...action.payload,
      ];
    },
    deleteStencilEdit: (state, action: PayloadAction<string>) => {
      const {
        editingInfo: { id, page },
      } = state;
      const useID = action?.payload || id;
      if (!useID || !page) return;
      // remove edits and clip paths for the selected element / page
      const newEdits = state.edits.stencilEdits?.filter(
        (edit) =>
          edit.id !== `${useID}-${page}` && edit.id !== `${useID}-clip-path`
      );
      state.edits.stencilEdits = newEdits;
    },
    setQrCodeInputValue: (state, action: PayloadAction<string>) => {
      state.qrCodeInputValue = action.payload;
    },
    setQrCodeSavedValue: (state, action: PayloadAction<string>) => {
      state.qrCodeSavedValue = action.payload;
    },
    setQrCodeSavePending: (state, action: PayloadAction<boolean>) => {
      state.qrCodeSavePending = action.payload;
    },
    setQrCodeSaveError: (state, action: PayloadAction<string>) => {
      state.qrCodeSaveError = action.payload;
      state.qrCodeSavePending = false;
    },
    setQrCodeSaveSuccess: (state, action: PayloadAction<string>) => {
      state.qrCodeSaveError = "";
      state.qrCodeSavePending = false;
      state.qrCodeSavedValue = action.payload;
    },
    toggleGridLines: (state) => {
      state.showGridLines = !state.showGridLines;
    },
    setInputFocus: (state, action: PayloadAction<boolean>) => {
      state.inputFocus = action.payload;
    },
    resetElementSelection: (state) => {
      const { editingInfo, styles } = initialState;
      state.editingInfo = editingInfo;
      state.styles = styles;
    },
    resetLiveEdit: () => initialState,
    updateElementCss: (
      state,
      action: PayloadAction<Record<string, string>>
    ) => {
      // optionally pass an id and page of the element in payload
      const page = action.payload.page || state.editingInfo.page;
      const id = action.payload.id || state.editingInfo.id;
      if (!id || !page) return { ...state };
      const newEdits = [...(state.edits.stencilEdits || [])];

      // get the index of the element being edited in the stencilEdits array
      const element = newEdits.find((el) => el.id === `${id}-${page}`);

      const getCssString = (obj: Record<string, string>) =>
        Object.entries(obj)
          .filter(([property]) => property !== "id" && property !== "page")
          .map(([property, value]) => `${property}:${value}`)
          .join(";");

      if (element) {
        // found an existing entry parse the css edit and save
        const cssString = element.cssPartial?.match(/\{(.*?)\}/)?.[1];
        let styleObject = parse(cssString || "");
        styleObject = { ...styleObject, ...action.payload };
        const cssPartial = `#${id}{${getCssString(styleObject)}}`;
        element.cssPartial = cssPartial;
      } else {
        // no edits found, push the edit as the first entry
        const cssPartial = `#${id}{${getCssString(action.payload)}}`;
        newEdits.push({
          id: `${id}-${page}`,
          page: `${page}`,
          type: "cssOverride",
          cssPartial,
        });
      }

      state.edits.stencilEdits = newEdits;
    },
  },
});

export const liveEditorActions = liveEditor.actions;
export default liveEditor.reducer;
