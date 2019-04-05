import React from 'react';
import PropTypes from 'prop-types';

export default function Link({ sort, to, children }) {
  return (
    <a
      onClick={event => {
        event.preventDefault();
        sort({ subreddit: to });
      }}
      href={to}
    >
      {children}
    </a>
  );
}

Link.propTypes = {
  to: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};
