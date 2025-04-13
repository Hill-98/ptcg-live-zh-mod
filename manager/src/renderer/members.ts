const members: [string, string][] = [['jojo552','https://paratranz.cn/users/923'],['lieyanqzu','https://paratranz.cn/users/49401'],['nanamiMora','https://paratranz.cn/users/49429'],['ikun514','https://paratranz.cn/users/49471'],['Xin Gao','https://paratranz.cn/users/49473'],['ZhengHong187','https://paratranz.cn/users/49474'],['yumoweishi','https://paratranz.cn/users/49499'],['back2zero','https://paratranz.cn/users/49501'],['liuyueyuren','https://paratranz.cn/users/49507'],['Gezelli-z','https://paratranz.cn/users/49517'],['camillaine','https://paratranz.cn/users/49522'],['TXFShenOwO','https://paratranz.cn/users/49523'],['Fang','https://paratranz.cn/users/49524'],['ResazurinChan','https://paratranz.cn/users/49525'],['SomnusJ','https://paratranz.cn/users/49527'],['NaMeless-0000','https://paratranz.cn/users/49805'],['XanSpectre','https://paratranz.cn/users/49814'],['0.6','https://paratranz.cn/users/49874'],['Zorisu','https://paratranz.cn/users/49875'],['taylorsix','https://paratranz.cn/users/49877'],['xiaobai22331','https://paratranz.cn/users/49884'],['tianxua','https://paratranz.cn/users/52755'],['Mifa17','https://paratranz.cn/users/52872'],['Myosotis1024','https://paratranz.cn/users/54804'],['cheKnowYoung','https://paratranz.cn/users/57503'],['B站实况游戏的狐狸','https://paratranz.cn/users/58711'],['ChpyX2','https://paratranz.cn/users/58841']]

document.getElementById('members')!.append(...members.map((member) => Object.assign(document.createElement('a'), {
  href: member[1],
  textContent: member[0],
  target: '_blank',
  title: member[0],
  rel: 'noopener noreferrer',
})))
