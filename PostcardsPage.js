import { useEffect, useState } from "react";
import { useHistory } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import MAILOUTS_CREATORS from "src/store/modules/mailouts/actions";
import { Grid, Header, Loader, Snackbar } from "src/components/Base";
import PageTitleHeader from "src/components/PageTitleHeader";
import usePageTitle from "src/components/Hooks/usePageTitle";
import { MailoutList } from ".";
import usePollListStatus from "./usePollListStatus";
import FirstTimeModal from "./FirstTimeModal";
import FilterSortDropdown from "../../components/FilterComponents/FilterSortDropdown";
import { onboardedActions } from "src/store/modules/onboarded/slice";
import { useDebounce } from "src/hooks/useDebounce";
import { useFetchMailouts } from "src/react-query/mailouts/useFetchMailoutList";
import {
  Button,
  InputSearch,
  SelectFilter,
} from "@brivity/marketer-components";
import clsx from "clsx";

const sortOptions = [
  { key: 0, text: "Created (Newest First)", value: "createdDateDesc" },
  { key: 1, text: "Created (Oldest First)", value: "createdDateAsc" },
  { key: 2, text: "Sent (Newest First)", value: "sendDateDesc" },
  { key: 3, text: "Sent (Oldest First)", value: "sendDateAsc" },
  { key: 4, text: "A-Z", value: "nameAToZ" },
  { key: 5, text: "Z-A", value: "nameZToA" },
];

const filterOptions = [
  { key: 0, text: "All Statuses", value: "" },
  { key: 1, text: "Unsent", value: "unsent" },
  { key: 2, text: "Sent (All sent statuses)", value: "approved" },
  { key: 3, text: "Sent (Queued for Printing)", value: "queued-for-printing" },
  { key: 4, text: "Sent (Printing)", value: "printing" },
  { key: 5, text: "Sent (Mailing)", value: "mailing" },
  { key: 6, text: "Sent (Complete)", value: "complete" },
  { key: 7, text: "Archived", value: "archived" },
];

const typeOptions = [
  { key: 0, text: "All Types", value: "" },
  { key: 1, text: "Postcards", value: "postcard" },
  { key: 2, text: "Folded Cards", value: "folded" },
];

const PostcardsPage = () => {
  const history = useHistory();
  const dispatch = useDispatch();

  usePageTitle("Mailers");
  usePollListStatus();

  const { seenDashboardModel: seen } = useSelector((store) => store.onboarded);
  const seenDashboardModel = seen || localStorage.getItem("seenDashboardModel");

  const { filters } = useSelector((store) => store.mailouts);

  const {
    text: textValue,
    sortBy: sortByValue,
    filter: filterValue,
    type: typeValue,
  } = filters;

  const {
    isFetched,
    isLoading,
    data: mailoutList,
    error: mailoutError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFetchMailouts({
    ...filters,
  });

  const pending = !isFetched || isLoading || isFetchingNextPage;
  const { message: error } = mailoutError ?? {};
  const [filter, setFilter] = useState(
    filterOptions.find((option) => option.value === filterValue)
  );
  const [typeOption, setTypeOption] = useState(
    typeOptions.find((option) => option.value === typeValue)
  );

  const dismissDashboardExplanation = () =>
    dispatch(onboardedActions.setCompletedDashboardModal());

  const [text, setText] = useState(textValue);
  const debouncedSearchTerm = useDebounce(text, 750);

  useEffect(() => {
    if (text === debouncedSearchTerm) {
      dispatch(MAILOUTS_CREATORS.updateFilters({ text: debouncedSearchTerm }));
    }
  }, [debouncedSearchTerm, text, dispatch]);

  return (
    <div>
      <PageTitleHeader>
        <div className='flex items-center flex-1 flex-wrap gap-4'>
          <h1 className='mr-4'>Mailers</h1>
          <InputSearch
            wrapperClasses='flex-[1_0_250px] max-w-[600px]'
            inputClasses='text-lg font-normal	py-[6px] '
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Search by Name, Address or MLS#'
          />
          <FilterSortDropdown
            onChangeHandler={(e, { value }) => {
              dispatch(MAILOUTS_CREATORS.updateFilters({ sortBy: value }));
            }}
            sortOptions={sortOptions}
            placeholder='Sort By'
            selection
            value={sortByValue}
          />
          {/* statuses filters */}
          <SelectFilter
            selectedFilter={filter}
            filterOptions={filterOptions}
            onChange={(filterOption) => {
              dispatch(
                MAILOUTS_CREATORS.updateFilters({ filter: filterOption.value })
              );
              setFilter(filterOption);
            }}
          />
          {/* types filters */}
          <SelectFilter
            selectedFilter={typeOption}
            filterOptions={typeOptions}
            onChange={(filterOption) => {
              dispatch(
                MAILOUTS_CREATORS.updateFilters({ type: filterOption.value })
              );
              setTypeOption(filterOption);
            }}
          />
        </div>
        <Button
          loading={pending}
          onClick={() => !pending && history.push("create-mailer")}
        >
          Add Campaign
        </Button>
      </PageTitleHeader>

      {error && <Snackbar error>{error}</Snackbar>}

      <section className='card-section'>
        <FirstTimeModal
          show={seenDashboardModel}
          action={dismissDashboardExplanation}
        />

        <Grid>
          <Grid.Row>
            <Grid.Column width={16}>
              {!pending && isFetched && mailoutList?.pages[0].length === 0 ? (
                <Header icon textAlign='center'>
                  <div className='flex justify-center text-xl font-bold'>
                    No Campaigns found.
                  </div>
                </Header>
              ) : (
                <MailoutList
                  filters={filters}
                  list={mailoutList?.pages}
                  searching={pending}
                />
              )}
            </Grid.Column>
          </Grid.Row>

          {hasNextPage && !pending && (
            <Grid.Row>
              <Grid.Column width={16}>
                <Grid centered columns={2}>
                  <Grid.Column>
                    <button
                      id='loadMoreButton'
                      className={clsx(
                        "w-full p-2 text-center bg-grey-10",
                        "hover:bg-grey-15 rounded-sm",
                        "text-lg font-bold uppercase"
                      )}
                      onClick={() => fetchNextPage()}
                      onKeyPress={(e) => {
                        // Prevent the default action to stop scrolling when space is pressed
                        e.preventDefault();
                        fetchNextPage();
                      }}
                    >
                      {pending ? (
                        <Loader active size='tiny' inline='centered' />
                      ) : (
                        "Load More"
                      )}
                    </button>
                  </Grid.Column>
                </Grid>
              </Grid.Column>
            </Grid.Row>
          )}
        </Grid>
      </section>
    </div>
  );
};

export default PostcardsPage;
