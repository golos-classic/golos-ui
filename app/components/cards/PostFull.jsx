import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router';
import { connect } from 'react-redux';
import tt from 'counterpart';
import { Asset } from 'golos-lib-js/lib/utils'

import user from 'app/redux/User';
import transaction from 'app/redux/Transaction';
import { repLog10, parsePayoutAmount } from 'app/utils/ParsersAndFormatters';
import extractContent from 'app/utils/ExtractContent';
import { immutableAccessor, objAccessor } from 'app/utils/Accessors';
import { isPostVisited, visitPost, randomString } from 'app/utils/helpers';
import Icon from 'app/components/elements/Icon';
import TimeVersions from 'app/components/elements/TimeVersions';
import Voting from 'app/components/elements/Voting';
import Reblog from 'app/components/elements/Reblog';
import MarkdownViewer from 'app/components/cards/MarkdownViewer';
import ReplyEditor from 'app/components/elements/ReplyEditor';
import TagList from 'app/components/elements/TagList';
import Author from 'app/components/elements/Author';
import ForeignApp from 'app/components/elements/ForeignApp'
import Userpic from 'app/components/elements/Userpic';
import PostFormLoader from 'app/components/modules/PostForm/loader';
import CommentFormLoader from 'app/components/modules/CommentForm/loader';
import { isBlocked } from 'app/utils/blacklist'
import { getEditDraftPermLink } from 'app/utils/postForm';
import { proxifyImageUrl } from 'app/utils/ProxifyUrl';
import { makeOid } from 'app/utils/sponsors'
import PostSummaryThumb from 'app/components/elements/PostSummaryThumb';
import { SEO_TITLE, CHANGE_IMAGE_PROXY_TO_STEEMIT_TIME } from 'app/client_config';


function TimeAuthorCategory({ content, authorRepLog10, showTags }) {
    return (
        <span className="PostFull__time_author_category vcard">
            <Icon name="clock" className="space-right" />
            <TimeVersions content={content} />
            {' '}
            <Author author={content.author} authorRepLog10={authorRepLog10} />
            {showTags && (
                <span>
                    {' '}
                    {tt('g.in')} <TagList post={content} single />
                </span>
            )}
        </span>
    );
}

function TimeAuthorCategoryLarge({ content, authorRepLog10 }) {
    const foreignApp = content.stats && content.stats.foreignApp
    return (
        <span className="PostFull__time_author_category_large vcard">
            <span className="float-right eye">
                <Icon name='eye' /> {content.views}
            </span>
            <TimeVersions content={content} className='float-right' />
            {foreignApp && <span className='float-right'>
                <ForeignApp foreignApp={foreignApp} />
                &nbsp;&nbsp;
            </span>}
            <Userpic account={content.author} reputation={authorRepLog10} />
            <div className="right-side">
                <Author
                    author={content.author}
                    authorRepLog10={authorRepLog10}
                    donateUrl={content.url}
                />
                <span>
                    {' '}
                    {tt('g.in')} <TagList post={content} single />
                </span>
            </div>
        </span>
    );
}

class PostFull extends React.Component {
    static propTypes = {
        // html props
        /* Show extra options (component is being viewed alone) */
        cont: PropTypes.object.isRequired,
        post: PropTypes.string.isRequired,
        aiPosts: PropTypes.array,

        // connector props
        username: PropTypes.string,
        unlock: PropTypes.func.isRequired,
        deletePost: PropTypes.func.isRequired,
        showPromotePost: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);

        const formId = `postFull-${props.post}`;

        this.PostFullEditor = ReplyEditor(formId + '-edit');

        this.state = {
            formId,
        };

        if (process.env.BROWSER) {
            const { formId } = this.state;

            const showEditorJson = localStorage.getItem('showEditor-' + formId);

            if (showEditorJson) {
                const showEditor = JSON.parse(showEditorJson);

                if (showEditor.type === 'edit') {
                    const permLink = getEditDraftPermLink();
                    const content = this.props.cont.get(this.props.post);

                    if (permLink === content.get('permlink')) {
                        this.state.showEdit = true;
                    }
                } else if (showEditor.type === 'reply') {
                    this.state.showReply = true;
                }

                if (!isPostVisited(this.props.post)) {
                    visitPost(this.props.post);
                }
            }
        }
    }

    shouldComponentUpdate(props, state) {
        const { cont, post, prevPosts, username, pso, loginBlurring } = this.props;

        return (
            cont !== props.cont ||
            post !== props.post ||
            prevPosts.length !== props.prevPosts.length ||
            username !== props.username ||
            pso !== props.pso ||
            this.state !== state ||
            props.loginBlurring !== loginBlurring
        );
    }

    componentDidMount () {
        const script = document.createElement("script");

        script.src = "https://app.sharpay.io/api/script.js";
        script.async = true;

        document.body.appendChild(script);
    }

    onShowReply = () => {
        const { showReply, formId } = this.state;
        const newShowReply = !showReply;

        this.setState({
            showReply: newShowReply,
            showEdit: false,
        });

        saveOnShow(formId, newShowReply ? 'reply' : null);
    };

    onShowEdit = () => {
        this.setState({
            showEdit: true,
            showReply: false,
        });

        saveOnShow(this.state.formId, 'edit');
    };

    onDeletePost = () => {
        const content = this.props.cont.get(this.props.post);
        this.props.deletePost(content.get('author'), content.get('permlink'));
    };

    becomeSponsor = async (e) => {
        e.preventDefault()

        const { username, pso } = this.props
        this.props.becomeSponsor(username, pso.author, pso.cost, pso.tip_cost, () => {
            this.setState({
                hideSponsorBtn: true
            })
        }, (err) => {
        })
    }

    showPromotePost = () => {
        const postContent = this.props.cont.get(this.props.post);

        if (!postContent) {
            return;
        }

        const author = postContent.get('author');
        const permlink = postContent.get('permlink');

        this.props.showPromotePost(author, permlink);
    };

    render() {
        const { username, post, cont, loginBlurring } = this.props;
        const { showReply, showEdit } = this.state;

        const postContent = cont.get(post);

        if (!postContent) {
            return null;
        }

        const p = extractContent(immutableAccessor, postContent);
        const content = postContent.toJS();
        const { author, permlink, parent_author, parent_permlink, root_author, encrypted, decrypt_fee } = content;
        const jsonMetadata = showReply ? null : p.json_metadata;
        let link = `/@${content.author}/${content.permlink}`;

        const { category, title, body } = content;

        if (category) {
            link = `/${category}${link}`;
        }

        if (process.env.BROWSER && !loginBlurring && title) {
            document.title = title + ' | ' + SEO_TITLE;
        }

        const replyParams = {
            author,
            permlink,
            parent_author,
            parent_permlink,
            root_author,
            category,
            title,
            body,
            encrypted,
            decrypt_fee: decrypt_fee ? Asset(decrypt_fee) : null,
        };

        const APP_DOMAIN = $STM_Config.site_domain;

        this.share_params = {
            link,
            url: 'https://' + APP_DOMAIN + link,
            title: title + ' | ' + SEO_TITLE,
            desc: p.desc,
        };

        const authorRepLog10 = repLog10(content.author_reputation);

        let isMobile = false;
        if (process.env.BROWSER) {
            isMobile = window.matchMedia('screen and (max-width: 39.9375em)').matches;
        }

        let prevPosts = [];
        for (let pp of this.props.prevPosts) {
            let pp2 = extractContent(objAccessor, pp);
            let iurl = proxifyImageUrl('', isMobile ? '800x600' : '256x512');
            if (Date.parse(pp2.created) > CHANGE_IMAGE_PROXY_TO_STEEMIT_TIME) {
                iurl += pp2.image_link
            } else {
                iurl += pp2.image_link
            }

            if (!pp2.image_link) {
                iurl = '/images/noimage.png';
            }
            const prevPost = (<PostSummaryThumb
              key={pp2.link}
              visitedClassName=""
              mobile={false}
              isNsfw={false}
              src={iurl}
              href={pp2.link}
              title={pp2.title}
              body={pp2.body} />)
            prevPosts.push(prevPost)
        }

        return (
            <article
                className={"PostFull hentry " + (loginBlurring ? 'blurring' : '')}
                itemScope
                itemType="http://schema.org/blogPost"
            >
                {showEdit
                    ? this._renderPostEditor(replyParams, jsonMetadata, content)
                    : this._renderContent(
                          postContent,
                          content,
                          jsonMetadata,
                          authorRepLog10
                      )}
                {this._renderFooter(postContent, content, link, authorRepLog10)}
                {showReply ? (
                    <div className="row">
                        <div className="column large-8 medium-10 small-12">
                            {this._renderReplyEditor(
                                replyParams,
                                p.json_metadata
                            )}
                        </div>
                    </div>
                ) : null}
                {prevPosts.length > 0 && (
                    <div className="row strikeprev">
                        <span>{tt('postfull_jsx.prev_posts')}</span>
                    </div>
                )}
                {prevPosts.length > 0 && (
                    <div className="row PostFull__prevPosts">
                    	<div>{prevPosts}</div>
                    </div>
                )}
            </article>
        );
    }

    _renderPostEditor(replyParams, jsonMetadata, content) {
        /*if (window.IS_MOBILE) {
            return (
                <this.PostFullEditor
                    {...replyParams}
                    type="edit"
                    jsonMetadata={jsonMetadata}
                    successCallback={this._onEditFinish}
                    onCancel={this._onEditFinish}
                />
            );
        } else */{
            if (content.depth) {
                return this._renderReplyEditor(replyParams, jsonMetadata, true);
            } else {
                return (
                    <PostFormLoader
                        editMode
                        editParams={replyParams}
                        jsonMetadata={jsonMetadata}
                        onSuccess={this._onEditFinish}
                        onCancel={this._onEditFinish}
                    />
                );
            }
        }
    }

    _renderReplyEditor(replyParams, jsonMetadata, isEdit) {
        return (
            <CommentFormLoader
                editMode={isEdit}
                reply={!isEdit}
                params={replyParams}
                jsonMetadata={jsonMetadata}
                onSuccess={this._onEditFinish}
                onCancel={this._onEditFinish}
            />
        )
    }

    _renderContent(postContent, content, jsonMetadata, authorRepLog10) {
        const { username, post, pso, loginBlurring } = this.props;
        const { author, permlink, category } = content;

        const url = `/${category}/@${author}/${permlink}`;
        let contentBody;

        if (isBlocked(url, $STM_Config.blocked_posts) && !username) {
            contentBody = tt(
                'postfull_jsx.this_post_is_not_available_due_to_breach_of_legislation'
            );
        } else {
            contentBody = content.body;
        }

        const payout =
            parsePayoutAmount(content.pending_payout_value) +
            parsePayoutAmount(content.total_payout_value);

        let postHeader;

        if (content.depth > 0) {
            const parent_link = `/${category}/@${content.parent_author}/${
                content.parent_permlink
            }`;

            let direct_parent_link;

            if (content.depth > 1) {
                direct_parent_link = (
                    <li>
                        <Link to={parent_link}>
                            {tt('g.view_the_direct_parent')}
                        </Link>
                    </li>
                );
            }

            const rt = loginBlurring ? randomString(content.root_title) : content.root_title
            postHeader = (
                <div className="callout">
                    <h3 className="entry-title">
                        {tt('g.re')}: {rt}
                    </h3>
                    <h5>
                        {tt('g.you_are_viewing_a_single_comments_thread_from')}:
                    </h5>
                    <p>{rt}</p>
                    <ul>
                        <li>
                            <Link to={content.url}>
                                {tt('g.view_the_full_context')}
                            </Link>
                        </li>
                        {direct_parent_link}
                    </ul>
                </div>
            );
        } else {
            const ct = loginBlurring ? randomString(content.title) : content.title
            postHeader = (
                <h1 className="entry-title">
                    {ct}
                </h1>
            );
        }

        contentBody = loginBlurring ? randomString(contentBody) : contentBody

        const main = [
            <span key="content">
                <div className="PostFull__header">
                    {postHeader}
                    <TimeAuthorCategoryLarge
                        content={content}
                        authorRepLog10={authorRepLog10}
                    />
                </div>
                <div className="PostFull__body entry-content">
                    <MarkdownViewer
                        formId={this.state.formId + '-viewer'}
                        text={contentBody}
                        jsonMetadata={jsonMetadata}
                        large
                        highQualityPost={payout > 10}
                        noImage={!content.stats.pictures}
                        timeCteated={new Date(content.created)}
                    />
                </div>
            </span>,
        ];

        if (pso && !this.state.hideSponsorBtn && username !== author) {
            main.push(
                <button
                    key="b1"
                    className="Promote__button float-right button hollow tiny"
                    onClick={this.becomeSponsor}
                >
                    {tt('poststub.become_sponsor')}
                </button>
            )
        }

        const showPromote =
            username &&
            postContent.get('last_payout') === '1970-01-01T00:00:00' &&
            postContent.get('depth') == 0; // TODO: audit after HF17. #1259

        if (showPromote) {
            main.push(
                <button
                    key="b2"
                    className="Promote__button float-right button hollow tiny"
                    onClick={this.showPromotePost}
                >
                    {tt('g.promote')}
                </button>
            );
        }

        main.push(<TagList key="tags" post={content} horizontal />);

        return main;
    }

    _renderFooter(postContent, content, link, authorRepLog10) {
        const { username, post, } = this.props;
        const { showReply, showEdit } = this.state;
        const { author, permlink } = content;

        const _isPaidout =
            postContent.get('cashout_time') === '1969-12-31T23:59:59';

        const showReplyOption = postContent.get('depth') < 255;
        const showEditOption = username === author;
        const showDeleteOption =
            username === author && content.stats.allowDelete && !_isPaidout;

        // check if post was created before view-count tracking began (2016-12-03)
        const isPreViewCount =
            Date.parse(postContent.get('created')) < 1480723200000;

        return (
            <div className="PostFull__footer row">
                <div className="column">
                    <TimeAuthorCategory
                        content={content}
                        authorRepLog10={authorRepLog10}
                    />
                    <Voting post={post} />
                </div>
                <div className="RightShare__Menu small-11 medium-5 large-5 columns text-right">

                        <Reblog author={author} permlink={permlink} />
                        <span className="PostFull__reply">
                            {showReplyOption ? (
                                <a onClick={this.onShowReply}>
                                    {tt('g.reply')}
                                </a>
                            ) : <span className="error" title={"Пользователь не желает получать комментарии"}>{tt('g.reply')}</span>}
                            {showEditOption && !showEdit ? (
                                <a onClick={this.onShowEdit}>{tt('g.edit')}</a>
                            ) : null}{' '}
                            {showDeleteOption && !showReply ? (
                                <a onClick={this.onDeletePost}>
                                    {tt('g.delete')}
                                </a>
                            ) : null}
                        </span>

                    <span className="PostFull__responses">
                        <Link
                            to={link}
                            title={tt('votesandcomments_jsx.view_count', {
                                count: content.views,
                            })}
                        >
                            <Icon name="eye" className="space-right" />
                            {content.views}
                        </Link>
                    </span>
                    <span className="PostFull__responses">
                        <Link
                            to={link}
                            title={tt('votesandcomments_jsx.response_count', {
                                count: content.children,
                            })}
                        >
                            <Icon name="chatboxes" className="space-right" />
                            {content.children}
                        </Link>
                    </span>
                    <span className={"shareMenu"}>
                        <div className="sharpay_widget_simple" data-sharpay="golid" data-height="18" data-form="no" data-hover="lighter" data-font="#8a8a8a" data-align="right" data-limit="3"></div>
                    </span>
                </div>
            </div>
        );
    }

    _onEditFinish = () => {
        this.setState({
            showReply: false,
            showEdit: false,
        });

        saveOnShow(this.state.formId, null);
    };
}

function saveOnShow(formId, type) {
    if (process.env.BROWSER) {
        if (type) {
            localStorage.setItem(
                'showEditor-' + formId,
                JSON.stringify({ type }, null, 0)
            );
        } else {
            localStorage.removeItem('showEditor-' + formId);
            localStorage.removeItem('replyEditorData-' + formId + '-reply');
            localStorage.removeItem('replyEditorData-' + formId + '-edit');
        }
    }
}

export default connect(
    (state, props) => {
        const username = state.user.getIn(['current', 'username'])

        let prevPosts = state.global.get('prev_posts')
        prevPosts = prevPosts ? prevPosts.toJS() : []

        const pso = state.global.get('pso')

        const loginDefault = state.user.get('loginDefault')
        const loginBlurring = loginDefault && loginDefault.get('blurring')

        return {
            ...props,
            username,
            prevPosts,
            pso: pso ? pso.toJS() : null,
            loginBlurring
        }
    },

    dispatch => ({
        dispatchSubmit(data) {
            dispatch(user.actions.usernamePasswordLogin({ ...data }));
        },
        clearError() {
            dispatch(user.actions.loginError({ error: null }));
        },
        unlock() {
            dispatch(user.actions.showLogin());
        },
        deletePost(author, permlink) {
            dispatch(
                transaction.actions.broadcastOperation({
                    type: 'delete_comment',
                    operation: { author, permlink },
                    confirm: tt('g.are_you_sure'),
                })
            );
        },
        becomeSponsor(username, author, amount, from_tip, onSuccess, onError) {
            let confirm = tt('poststub.for_sponsors2')
            confirm += Asset(amount).floatString
            if (from_tip) {
                confirm += tt('poststub.for_sponsors3')
            }
            confirm += tt('poststub.for_sponsors4')
            confirm += ' ' + tt('poststub.for_sponsors5')
            confirm += ' ' + tt('g.are_you_sure')
            dispatch(transaction.actions.broadcastOperation({
                type: 'paid_subscription_transfer',
                operation: {
                    from: username,
                    to: author,
                    oid: makeOid(),
                    amount,
                    memo: '',
                    from_tip,
                },
                confirm,
                username,
                successCallback: () => {
                    onSuccess()
                },
                errorCallback: (err) => {
                    onError(err)
                }
            }))
        },
        showPromotePost(author, permlink) {
            dispatch({
                type: 'global/SHOW_DIALOG',
                payload: { name: 'promotePost', params: { author, permlink } },
            });
        },
    })
)(PostFull);
