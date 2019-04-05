import { useReducer, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import subreddits from '../data/subreddits';

const baseUrl =
  process.env.NODE_ENV === 'development'
    ? `http://localhost:${process.env.PORT}`
    : 'https://vose.tv';

// Dropdown options
const sortOptions = ['hot', 'new', 'controversial', 'top', 'rising'];
const timeRangeOptions = ['hour', 'day', 'week', 'month', 'year', 'all'];

function getWatchedVideos() {
  let watchedVideos;
  try {
    watchedVideos =
      localStorage.getItem('watchedVideos') === null
        ? {}
        : JSON.parse(localStorage.getItem('watchedVideos'));
  } catch {
    watchedVideos = {};
  }
  return watchedVideos;
}

function reducer(state, action) {
  switch (action.type) {
    case 'loading':
      // TODO fetchVideos useEffect when videos is null
      const {
        subreddit = state.subreddit,
        sorting = state.sorting,
        timeRange = state.timeRange,
      } = action.payload;
      return {
        ...state,
        // TODO isLoading
        currentVideoIndex: 0,
        currentVideo: null,
        videos: null,

        subreddit,
        sorting,
        timeRange,
        // TODO merge old state in here
      };
    case 'videos loaded':
      const { videos } = action.payload;
      return {
        ...state,
        videos,
        currentVideo: videos[0],
        watchedVideos: {
          ...state.watchedVideos,
          ...{ [videos[0].id]: true },
        },
      };
    case 'next':
    case 'prev':
    case 'video change':
      let currentVideoIndex;
      if (action.type === 'next') {
        currentVideoIndex = Math.min(
          state.currentVideoIndex + 1,
          state.videos.length - 1,
        );
        // TODO currentVideoIndex = Math.min(Math.max(currentVideoIndex, 0), state.videos.length)
      } else if (action.type === 'prev') {
        currentVideoIndex = Math.max(state.currentVideoIndex - 1, 0);
      } else {
        currentVideoIndex = action.payload.currentVideoIndex;
      }
      return {
        ...state,
        currentVideoIndex,
        currentVideo: state.videos[currentVideoIndex],
        watchedVideos: {
          ...state.watchedVideos,
          ...{ [state.videos[currentVideoIndex].id]: true },
        },
      };
    default:
      throw new Error();
  }
}

export default function VideoProvider({ preloadedState, children }) {
  const lastSessionRef = useRef();

  const [state, dispatch] = useReducer(reducer, {
    // App state
    currentVideoIndex: 0,
    currentVideo: null,

    watchedVideos: {
      ...getWatchedVideos(),
      ...{ [preloadedState.videos[0].id]: true },
    },

    // Sorting
    subreddit: 'videos',
    sorting: 'hot',
    timeRange: 'day',
    ...preloadedState,
  });

  useEffect(() => {
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('popstate', handlePopState);
    const { subreddit, sorting, timeRange } = state;
    const timeRangeQuery =
      ['top', 'controversial'].includes(sorting) && timeRange !== 'day'
        ? `/?t=${timeRange}`
        : '';
    const lastSegment = sorting === 'hot' ? '' : `/${sorting}${timeRangeQuery}`;

    history.replaceState({}, null, `/r/${subreddit}${lastSegment}`);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [state.subreddit, state.sorting, state.timeRange]);

  useEffect(() => {
    localStorage.setItem('watchedVideos', JSON.stringify(state.watchedVideos));
  }, [state.watchedVideos]);

  async function fetchVideos() {
    // Create session to avoid race condition
    const currentSession = {};
    lastSessionRef.current = currentSession;

    const { subreddit, sorting, timeRange } = state;

    const res = await fetch(
      `${baseUrl}/api/videos/${subreddit}/${sorting}/${timeRange}`,
    );

    const videos = await res.json();
    if (lastSessionRef.current !== currentSession) return;
    dispatch({
      type: 'videos loaded',
      payload: {
        videos,
      },
    });
  }

  function getSubAndSort(pathname) {
    const [subreddit = 'videos', sorting = 'hot'] = pathname
      // Remove multiple consecutive slashes from url
      .replace(/\/{2,}/g, '/')
      // Remove starting and trailing slashes
      .replace(/^\/|\/$/g, '')
      // get segemnts
      .split('/')
      // Remove "r" segment
      .slice(1);
    return [subreddit, sorting];
  }

  function getTimeRange(query) {
    const searchParams = new URLSearchParams(query);
    const timeRange = searchParams.get('t') || 'day';
    return timeRange;
  }

  function handlePopState(event) {
    const [subreddit, sorting] = getSubAndSort(location.pathname);
    const timeRange = getTimeRange(location.search);

    dispatch({
      type: 'loading',
      payload: {
        subreddit,
        timeRange,
        sorting,
      },
    });
  }

  function handleKeydown(event) {
    if (event.repeat) return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey)
      return;
    if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      // Allow scroll into view to work with arrow keys
      event.preventDefault();
    }

    if (['ArrowLeft', 'j'].includes(event.key)) {
      dispatch({ type: 'prev' });
    }
    if (['ArrowRight', 'k'].includes(event.key)) {
      dispatch({ type: 'next' });
    }
  }

  // NOTE Used to change video on VideoItem click
  function setVideo(currentVideoIndex) {
    dispatch({
      type: 'video change',
      payload: {
        currentVideoIndex,
      },
    });
  }

  function sort({ subreddit, sorting, timeRange }) {
    if (subreddit) {
      dispatch({ type: 'loading', payload: { subreddit, sorting: 'hot' } });
      history.pushState({}, null, `/r/${subreddit}`);
    } else if (sorting) {
      dispatch({ type: 'loading', payload: { sorting } });
      history.pushState({}, null, `/r/${state.subreddit}/${sorting}`);
    } else {
      dispatch({ type: 'loading', payload: { timeRange } });
      history.pushState(
        {},
        null,
        `/r/${state.subreddit}/${state.sorting}/?t=${timeRange}`,
      );
    }
  }

  const getSortProps = () => ({
    subreddits,
    sortOptions,
    timeRangeOptions,

    state: {
      subreddit: state.subreddit,
      sorting: state.sorting,
      timeRange: state.timeRange,
    },
  });

  const getPlayerProps = () => ({
    currentVideo: state.currentVideo,
    next: () => dispatch({ type: 'next' }),
  });

  const getVideoListProps = () => ({
    videos: state.videos,
    watchedVideos: state.watchedVideos,
    currentVideoIndex: state.currentVideoIndex,
    setVideo,
  });

  return typeof children === 'function'
    ? children({
        isEmpty: state.videos && state.videos.length === 0,
        getVideoListProps,
        getPlayerProps,
        getSortProps,
        sort,
      })
    : children || null;
}

VideoProvider.propTypes = {
  preloadedState: PropTypes.shape({
    videos: PropTypes.array,
    currentVideo: PropTypes.shape({
      title: PropTypes.string,
      flair: PropTypes.string,
      url: PropTypes.string,
      id: PropTypes.string,
      timestamp: PropTypes.number,
      score: PropTypes.number,
      comments: PropTypes.number,
    }),
    subreddit: PropTypes.string,
    sorting: PropTypes.string,
    timeRange: PropTypes.string,
  }),
};
