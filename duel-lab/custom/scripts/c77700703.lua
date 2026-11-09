--無秩序騎士ノヴルィ
--Disorder Knight Novry (original card)
--② the Special Summoned monster (either player's, one that has a Level) is treated as Level 9 for the Xyz Summon (EFFECT_XYZ_LEVEL)
--and, if the opponent controls it, can be used as your Xyz Material (EFFECT_XYZ_MATERIAL), like the official
--"Xyz Summon using only those 2 monsters" idiom (Gagaga Magician - Gagaga Magic).
local s,id=GetID()
local SET_ORDER=0x7c6
--EDOPro takes a "must use" group before the materials; MDPro3 (YGOPro) has no such argument (compat-mdpro3.lua).
local function xyzable(sc,mg,min,max)
	if Xyz.NoMustArg then return sc:IsXyzSummonable(mg,min,max) end
	return sc:IsXyzSummonable(nil,mg,min,max)
end
local function xyzsummon(tp,sc,mg,min,max)
	if Xyz.NoMustArg then return Duel.XyzSummon(tp,sc,mg,min,max) end
	return Duel.XyzSummon(tp,sc,nil,mg,min,max)
end
function s.initial_effect(c)
	--① Special Summon procedure from the hand: the opponent activated a monster effect during your Main Phase this turn
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetType(EFFECT_TYPE_FIELD)
	e1:SetCode(EFFECT_SPSUMMON_PROC)
	e1:SetProperty(EFFECT_FLAG_UNCOPYABLE)
	e1:SetRange(LOCATION_HAND)
	e1:SetCountLimit(1,{id,0},EFFECT_COUNT_CODE_OATH)
	e1:SetCondition(s.spcon)
	c:RegisterEffect(e1)
	--② a monster is Special Summoned: Xyz Summon using only this card and that monster (treated as Level 9)
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e2:SetType(EFFECT_TYPE_FIELD+EFFECT_TYPE_TRIGGER_O)
	e2:SetProperty(EFFECT_FLAG_DELAY)
	e2:SetCode(EVENT_SPSUMMON_SUCCESS)
	e2:SetRange(LOCATION_MZONE)
	e2:SetCountLimit(1,{id,1})
	e2:SetTarget(s.xyztg)
	e2:SetOperation(s.xyzop)
	c:RegisterEffect(e2)
	if not s.global_check then
		s.global_check=true
		local ge=Effect.GlobalEffect()
		ge:SetType(EFFECT_TYPE_FIELD+EFFECT_TYPE_CONTINUOUS)
		ge:SetCode(EVENT_CHAINING)
		ge:SetOperation(s.checkop)
		Duel.RegisterEffect(ge,0)
	end
end
s.listed_series={SET_ORDER}
function s.checkop(e,tp,eg,ep,ev,re,r,rp)
	local ph,turnp=Duel.GetCurrentPhase(),Duel.GetTurnPlayer()
	if re:IsActiveType(TYPE_MONSTER) and rp~=turnp and (ph==PHASE_MAIN1 or ph==PHASE_MAIN2) then
		Duel.RegisterFlagEffect(turnp,id,RESET_PHASE+PHASE_END,0,1)
	end
end
function s.spcon(e,c)
	if c==nil then return true end
	local tp=c:GetControler()
	return Duel.GetLocationCount(tp,LOCATION_MZONE)>0 and Duel.GetFlagEffect(tp,id)>0
end
--"treated as a Level 9 monster" (+ usable as your material while the opponent controls it); returns the effects to reset
local function treat(c,tc,tp)
	local e1=Effect.CreateEffect(c)
	e1:SetType(EFFECT_TYPE_SINGLE)
	e1:SetCode(EFFECT_XYZ_LEVEL)
	e1:SetValue(9)
	e1:SetReset(RESET_EVENT+RESETS_STANDARD)
	tc:RegisterEffect(e1,true)
	local effs={e1}
	if tc:IsControler(1-tp) then
		local e2=Effect.CreateEffect(c)
		e2:SetType(EFFECT_TYPE_SINGLE)
		e2:SetCode(EFFECT_XYZ_MATERIAL)
		e2:SetValue(aux.TRUE)
		e2:SetReset(RESET_EVENT+RESETS_STANDARD)
		tc:RegisterEffect(e2,true)
		effs[2]=e2
	end
	return effs
end
local function untreat(effs)
	for _,te in ipairs(effs) do te:Reset() end
end
function s.xyzfilter(sc,mg)
	return sc:IsType(TYPE_XYZ) and xyzable(sc,mg,2,2)
end
function s.mfilter(tc,tp,c)
	--Xyz/Link Monsters have no Level, so they cannot be treated as Level 9
	if tc==c or not (tc:IsLocation(LOCATION_MZONE) and tc:IsFaceup()) or tc:IsType(TYPE_XYZ+TYPE_LINK) then return false end
	local effs=treat(c,tc,tp)
	local res=Duel.IsExistingMatchingCard(s.xyzfilter,tp,LOCATION_EXTRA,0,1,nil,Group.FromCards(c,tc))
	untreat(effs)
	return res
end
function s.xyztg(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	if chk==0 then return c:IsFaceup() and eg:IsExists(s.mfilter,1,nil,tp,c) end
	local g=eg:Filter(s.mfilter,nil,tp,c)
	if #g>1 then
		Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_XMATERIAL)
		g=g:Select(tp,1,1,nil)
	end
	Duel.SetTargetCard(g)
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,1,tp,LOCATION_EXTRA)
end
function s.xyzop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	local tc=Duel.GetFirstTarget()
	if not (c:IsRelateToEffect(e) and c:IsFaceup() and tc and tc:IsRelateToEffect(e) and tc:IsFaceup()) then return end
	local effs=treat(c,tc,tp)
	local mg=Group.FromCards(c,tc)
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SPSUMMON)
	local sc=Duel.SelectMatchingCard(tp,s.xyzfilter,tp,LOCATION_EXTRA,0,1,1,nil,mg):GetFirst()
	if sc then
		xyzsummon(tp,sc,mg,2,2)
	else
		untreat(effs)
	end
end
