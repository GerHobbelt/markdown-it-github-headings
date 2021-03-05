module.exports = plugin;

let GithubSlugger = require('github-slugger');
let innertext = require('innertext');

let defaultOptions = {
  enableHeadingLinkIcons: true,
  prefixHeadingIds: true,
  prefix: 'user-content-',
  className: 'anchor',
  // shamelessly borrowed from GitHub, thanks y'all
  linkIcon: '<svg class="octicon octicon-link" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path fill-rule="evenodd" d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z"></path></svg>',
  resetSlugger: true
};

function plugin(md, _opts) {
  let options = Object.assign({}, defaultOptions, _opts);

  if (!options.prefixHeadingIds) options.prefix = '';

  let slugger = new GithubSlugger();
  let Token;

  md.core.ruler.push('headingLinks', function (state) {
    if (options.resetSlugger) {
      slugger.reset();
    }

    // save the Token constructor because we'll be building a few instances at render
    // time; that's sort of outside the intended markdown-it parsing sequence, but
    // since we have tight control over what we're creating (a link), we're safe
    if (!Token) {
      Token = state.Token;
    }
  });

  md.renderer.rules.heading_open = function (tokens, idx, opts, env, self) {
    let children = tokens[idx + 1].children;
    // make sure heading is not empty
    if (children && children.length) {
      // Generate an ID based on the heading's innerHTML; first, render without
      // converting gemoji strings to unicode emoji characters
      let unemojiWithToken = unemoji.bind(null, Token);
      let rendered = md.renderer.renderInline(children.map(unemojiWithToken), opts, env);
      let postfix = slugger.slug(
        innertext(rendered)
          .replace(/[<>]/g, '') // In case the heading contains `<stuff>`
          .toLowerCase() // because `slug` doesn't lowercase
      );

      // add 3 new token objects link_open, text, link_close
      let linkOpen = new Token('link_open', 'a', 1);
      let text = new Token('html_inline', '', 0);
      if (options.enableHeadingLinkIcons) {
        text.content = options.linkIcon;
      }
      let linkClose = new Token('link_close', 'a', -1);

      // add some link attributes
      linkOpen.attrSet('id', options.prefix + postfix);
      linkOpen.attrSet('class', options.className);
      linkOpen.attrSet('href', '#' + postfix);
      linkOpen.attrSet('aria-hidden', 'true');

      // add new token objects as children of heading
      children.unshift(linkClose);
      children.unshift(text);
      children.unshift(linkOpen);
    }

    return md.renderer.renderToken(tokens, idx, options, env, self);
  };
}

function unemoji(TokenConstructor, token) {
  if (token.type === 'emoji') {
    return Object.assign(new TokenConstructor(), token, { content: token.markup });
  }
  return token;
}
