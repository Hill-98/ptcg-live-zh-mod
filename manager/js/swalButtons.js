export const swalButtonDefaultOptions = {
    visible: true,
    closeModal: true,
};

export const swalButtonsOK = {
    confirm: {
        text: '确定',
        value: 'ok',
        ...swalButtonDefaultOptions,
    },
};

export const swalButtonsQuit = {
    confirm: {
        text: '退出',
        value: 'quit',
        ...swalButtonDefaultOptions,
    },
};

export const swalButtonsNoOrYes = {
    cancel: {
        text: '是',
        value: 'yes',
        ...swalButtonDefaultOptions,
    },
    confirm: {
        text: '否',
        value: 'no',
        ...swalButtonDefaultOptions,
    },
};

export const swalButtonsYesOrNo = {
    confirm: {
        text: '是',
        value: 'yes',
        ...swalButtonDefaultOptions,
    },
    cancel: {
        text: '否',
        value: 'no',
        ...swalButtonDefaultOptions,
    },
};
